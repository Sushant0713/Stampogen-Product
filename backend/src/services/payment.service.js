const crypto = require('crypto');
const Razorpay = require('razorpay');
const config = require('@config');
const AppError = require('@utils/AppError');
const { HTTP_STATUS, TENANT_STATUS } = require('@constants');
const PlanRepository = require('@repositories/plan.repository');
const DiscountRepository = require('@repositories/discount.repository');
const PaymentRepository = require('@repositories/payment.repository');
const UserRepository = require('@repositories/user.repository');
const TenantRepository = require('@repositories/tenant.repository');
const PlatformInvoiceService = require('@services/platformInvoice.service');
const InvoiceSettingsService = require('@services/invoiceSettings.service');
const { evaluateDiscount } = require('@helpers/discount.helper');
const { formatPrice } = require('@helpers/plan.helper');
const { scheduleOrApplyPurchase, markSubscriptionPaid, applyTrialPlan } = require('@helpers/billing.helper');
const { resolveTaxMode, calcLineTax } = require('@helpers/gstTax.helper');
const { sendFreeTrialStartedEmail } = require('@services/email.service');

function getRazorpayClient() {
  if (!config.razorpay.keyId || !config.razorpay.keySecret) {
    throw new AppError(
      'Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',
      HTTP_STATUS.SERVICE_UNAVAILABLE
    );
  }
  if (
    config.razorpay.keyId.includes('replace_me') ||
    config.razorpay.keySecret.includes('replace_me')
  ) {
    throw new AppError(
      'Replace Razorpay test keys in backend .env before taking payments.',
      HTTP_STATUS.SERVICE_UNAVAILABLE
    );
  }
  return new Razorpay({
    key_id: config.razorpay.keyId,
    key_secret: config.razorpay.keySecret,
  });
}

function toPaise(amountInr) {
  return Math.round(Number(amountInr) * 100);
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

async function resolvePlan(planIdOrCode) {
  const raw = String(planIdOrCode || '').trim();
  if (!raw) throw new AppError('Plan is required', HTTP_STATUS.BAD_REQUEST);

  let plan = null;
  if (/^[a-f\d]{24}$/i.test(raw)) {
    plan = await PlanRepository.findById(raw);
  }
  if (!plan) {
    plan = await PlanRepository.findByCode(raw.toLowerCase());
  }
  if (!plan) throw new AppError('Plan not found', HTTP_STATUS.NOT_FOUND);

  if (!plan.enabled || plan.status !== 'Active' || !plan.visibleWebsite) {
    throw new AppError('This plan is not available for purchase', HTTP_STATUS.BAD_REQUEST);
  }
  if (plan.priceCustom) {
    throw new AppError('Custom plans require contacting sales', HTTP_STATUS.BAD_REQUEST);
  }
  return plan;
}

async function resolveCustomerTaxContext({
  customerEmail = '',
  customerGstin = '',
  customerState = '',
} = {}) {
  const email = String(customerEmail || '')
    .trim()
    .toLowerCase();
  let gstin = String(customerGstin || '')
    .trim()
    .toUpperCase();
  let state = String(customerState || '').trim();
  let address = '';

  if (email) {
    try {
      const user = await UserRepository.findByEmail(email);
      const tenantId = user?.tenant?._id || user?.tenant;
      if (tenantId) {
        const tenant = await TenantRepository.findById(tenantId);
        const billing = tenant?.billingProfile || {};
        if (!gstin && billing.gstin) gstin = String(billing.gstin).trim().toUpperCase();
        if (!state && billing.state) state = String(billing.state).trim();
        address = [
          billing.address,
          billing.street,
          [billing.city, billing.state].filter(Boolean).join(', '),
          billing.pin ? `PIN ${billing.pin}` : '',
        ]
          .map((part) => String(part || '').trim())
          .filter(Boolean)
          .join('\n');
        if (!state && address) state = address;
      }
    } catch {
      // ignore lookup failures — still quote with whatever we have
    }
  }

  return { gstin, state, address, email };
}

async function applyGstToQuote(taxableAmount, customerCtx = {}) {
  const settings = await InvoiceSettingsService.get();
  const defaults = settings.defaults || {};
  const company = settings.company || {};

  const resolvedTaxMode = resolveTaxMode({
    companyGstin: company.gstin,
    customerGstin: customerCtx.gstin,
    companyState: company.address || company.state,
    customerState: customerCtx.state || customerCtx.address,
  });
  // Prefer place-of-supply resolution. Default to IGST (not SGST+CGST) when unknown —
  // most clients are outside the company state.
  const taxMode = resolvedTaxMode || 'igst';

  const tax = calcLineTax({
    taxable: taxableAmount,
    taxMode,
    gstRate: defaults.gstRate,
    igstRate: defaults.igstRate,
    sgstRate: defaults.sgstRate,
    cgstRate: defaults.cgstRate,
  });

  return {
    taxMode,
    taxLabel: tax.taxLabel,
    taxAmount: tax.taxAmt,
    taxRates: tax.rates,
    taxBreakdown: tax.breakdown,
    payableAmount: tax.total,
  };
}

async function quotePlan(plan, discountCode = '', customerOpts = {}) {
  const listAmount = roundMoney(Number(plan.priceAmount) || 0);
  const code = String(discountCode || '')
    .trim()
    .toUpperCase();

  let discountAmount = 0;
  let appliedCode = '';
  let discountId = null;

  if (code) {
    const discount = await DiscountRepository.findByCode(code);
    if (!discount) {
      throw new AppError('Invalid discount code', HTTP_STATUS.BAD_REQUEST);
    }

    const isPartnerDiscount =
      discount.type === 'Partner discount' || Boolean(discount.affiliateUser);
    const isOneTimeDiscount = discount.type === 'One Time Discount';

    if (isPartnerDiscount || isOneTimeDiscount) {
      const email = String(customerOpts.customerEmail || '')
        .trim()
        .toLowerCase();
      if (!email) {
        throw new AppError(
          isOneTimeDiscount
            ? 'One Time Discount applies only on first payment. Sign in to continue.'
            : 'Partner discount applies only on your first payment. Sign in to continue.',
          HTTP_STATUS.BAD_REQUEST
        );
      }
      const priorPayments = await PaymentRepository.countSuccessfulByCustomerEmail(email);
      if (priorPayments > 0) {
        throw new AppError(
          isOneTimeDiscount
            ? 'One Time Discount applies only on a client’s first payment'
            : 'Partner discount applies only on a client’s first payment',
          HTTP_STATUS.BAD_REQUEST
        );
      }
    }

    const result = evaluateDiscount(discount, {
      orderAmount: listAmount,
      planName: plan.name,
      billingCycle: plan.billing,
    });

    if (!result.ok) {
      throw new AppError(result.reason || 'Discount cannot be applied', HTTP_STATUS.BAD_REQUEST);
    }

    discountAmount = roundMoney(result.discountAmount);
    appliedCode = result.code;
    discountId = discount._id;
  }

  const taxableAmount = Math.max(0, roundMoney(listAmount - discountAmount));
  const customerCtx = await resolveCustomerTaxContext(customerOpts);
  const gst = await applyGstToQuote(taxableAmount, customerCtx);

  return {
    plan: {
      id: String(plan._id),
      name: plan.name,
      code: plan.code,
      billing: plan.billing,
      priceAmount: listAmount,
      priceLabel: formatPrice(plan),
      ctaText: plan.ctaText || 'Get early access',
      description: plan.description || '',
      forOutlet: Boolean(plan.forOutlet),
    },
    discountCode: appliedCode,
    discountId,
    listAmount,
    discountAmount,
    taxableAmount,
    taxMode: gst.taxMode,
    taxLabel: gst.taxLabel,
    taxAmount: gst.taxAmount,
    taxRates: gst.taxRates,
    taxBreakdown: gst.taxBreakdown,
    payableAmount: gst.payableAmount,
    currency: 'INR',
    customerTax: {
      gstin: customerCtx.gstin || '',
      state: customerCtx.state || '',
    },
  };
}

/** Attach / schedule the purchased plan on the admin's shop/tenant. */
async function activateTenantPlanFromPayment(payment) {
  const email = String(payment.customerEmail || '')
    .trim()
    .toLowerCase();
  if (!email || !payment.planName) return null;

  // Signup mode: create User + Tenant from pending draft, then attach plan
  if (payment.pendingRegistration) {
    const AuthService = require('@services/auth.service');
    const PendingAdminRegistrationRepository = require('@repositories/pendingAdminRegistration.repository');
    const pendingId = payment.pendingRegistration._id || payment.pendingRegistration;
    let pending = await PendingAdminRegistrationRepository.findById(pendingId, {
      withSecrets: true,
    });
    if (!pending) {
      // Draft may already have been consumed on a prior verify retry
      const existingUser = await UserRepository.findByEmail(email);
      if (!existingUser) {
        throw new AppError(
          'Registration draft expired. Please register again.',
          HTTP_STATUS.BAD_REQUEST
        );
      }
    } else {
      await AuthService.createAdminAccountFromPending(pending);
    }
  }

  const user = await UserRepository.findByEmail(email);
  const tenantId = user?.tenant?._id || user?.tenant;
  if (!tenantId) return null;

  const tenant = await TenantRepository.findById(tenantId);
  if (!tenant) return null;

  // Outlet seat plans grant a seat on HQ — do not overwrite the shop subscription.
  const plan =
    (payment.planCode && (await PlanRepository.findByCode(payment.planCode))) ||
    (payment.planName && (await PlanRepository.findByName(payment.planName))) ||
    null;
  if (plan?.forOutlet) {
    if (tenant.kind === 'outlet') {
      throw new AppError('Outlet accounts cannot buy outlet plans', HTTP_STATUS.FORBIDDEN);
    }
    const OutletService = require('@services/outlet.service');
    return OutletService.grantSeatFromPayment(payment, plan);
  }

  const planName = payment.planName;
  // Cycle price = taxable (plan − discount), not GST-inclusive total
  const pricePerCycle =
    payment.taxableAmount != null
      ? Number(payment.taxableAmount)
      : Math.max(0, Number(payment.listAmount || 0) - Number(payment.discountAmount || 0));
  const purchasedAt = payment.paidAt ? new Date(payment.paidAt) : new Date();

  const { tenant: updated } = scheduleOrApplyPurchase(tenant, {
    planName,
    pricePerCycle,
    billing: payment.billing || 'Monthly',
    purchasedAt,
  });
  const paid = markSubscriptionPaid(updated);

  return TenantRepository.updateById(tenantId, {
    currentPlan: paid.currentPlan,
    pendingPlan: paid.pendingPlan,
    billingHistory: paid.billingHistory,
    subscriptionSource: paid.subscriptionSource,
    trial: paid.trial,
    reservedDiscountCode: '',
    status: TENANT_STATUS.ACTIVE,
  });
}

/** Issue platform invoice + email to the admin after successful payment (once per payment). */
async function issuePaymentInvoice(paymentDoc) {
  if (!paymentDoc || paymentDoc.invoiceNumber) {
    return paymentDoc?.invoiceNumber
      ? {
          invoiceNumber: paymentDoc.invoiceNumber,
          emailed: Boolean(paymentDoc.invoiceEmailed),
          recipient: paymentDoc.invoiceRecipient || null,
        }
      : null;
  }

  const email = String(paymentDoc.customerEmail || '')
    .trim()
    .toLowerCase();
  if (!email) return null;

  const user = await UserRepository.findByEmail(email);
  const tenantId = user?.tenant?._id || user?.tenant;
  if (!tenantId) {
    console.error('[invoice] No tenant found for payment customer', email);
    return null;
  }

  const tenant = await TenantRepository.findById(tenantId);
  if (!tenant) return null;

  const tenantPlain = tenant.toObject ? tenant.toObject() : tenant;
  if (!tenantPlain.owner || typeof tenantPlain.owner !== 'object') {
    tenantPlain.owner = user?.toObject ? user.toObject() : user;
  }

  try {
    const invoice = await PlatformInvoiceService.issueForPayment({
      tenant: tenantPlain,
      payment: paymentDoc.toObject ? paymentDoc.toObject() : paymentDoc,
    });

    if (!invoice?.invoiceNumber) return null;

    await PaymentRepository.updateById(paymentDoc._id, {
      invoiceNumber: invoice.invoiceNumber,
      invoiceEmailed: Boolean(invoice.emailed),
      invoiceRecipient: invoice.recipient || null,
      invoicedAt: new Date(),
    });

    return invoice;
  } catch (error) {
    console.error('[invoice] Failed to issue payment invoice:', error.message);
    return null;
  }
}

function queuePaymentInvoice(paymentDoc) {
  if (!paymentDoc?._id) return { pending: true };
  setImmediate(() => {
    issuePaymentInvoice(paymentDoc).catch((error) => {
      console.error('[invoice] Background invoice failed:', error.message);
    });
  });
  return { pending: true };
}

class PaymentService {
  async preview(body = {}) {
    const plan = await resolvePlan(body.planId || body.planCode);
    return quotePlan(plan, body.discountCode, {
      customerEmail: body.customerEmail,
      customerGstin: body.customerGstin,
      customerState: body.customerState,
    });
  }

  async createOrder(body = {}, actorOrUser = {}) {
    // Accept `{ user, pendingRegistration }` or a legacy user doc as the 2nd arg
    const user =
      actorOrUser?.user ||
      (actorOrUser?.email && !actorOrUser?.pendingRegistration ? actorOrUser : null);
    const pendingRegistration = actorOrUser?.pendingRegistration || null;

    // Bind purchase to authenticated admin OR verified registration draft — never trust client email.
    let customerEmail = '';
    let pendingRegistrationId = null;
    let fallbackName = '';

    if (pendingRegistration) {
      customerEmail = String(pendingRegistration.email || '')
        .trim()
        .toLowerCase();
      pendingRegistrationId = pendingRegistration._id;
      fallbackName = [pendingRegistration.firstName, pendingRegistration.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
    } else {
      customerEmail = String(user?.email || '')
        .trim()
        .toLowerCase();
      fallbackName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
    }

    if (!customerEmail) {
      throw new AppError('Authentication required for checkout', HTTP_STATUS.UNAUTHORIZED);
    }

    const plan = await resolvePlan(body.planId || body.planCode);

    const customerName = String(body.customerName || '').trim() || fallbackName;
    const customerPhone =
      String(body.customerPhone || '').trim() ||
      String(pendingRegistration?.phone || pendingRegistration?.billingProfile?.phone || '').trim() ||
      String(user?.phone || '').trim();

    if (!customerName) throw new AppError('Name is required', HTTP_STATUS.BAD_REQUEST);

    const quote = await quotePlan(plan, body.discountCode, {
      customerEmail,
      customerGstin:
        body.customerGstin || pendingRegistration?.billingProfile?.gstin || undefined,
      customerState:
        body.customerState || pendingRegistration?.billingProfile?.state || undefined,
    });

    const payment = await PaymentRepository.create({
      plan: plan._id,
      planName: plan.name,
      planCode: plan.code,
      billing: plan.billing,
      customerName,
      customerEmail,
      customerPhone,
      listAmount: quote.listAmount,
      discountCode: quote.discountCode,
      discountAmount: quote.discountAmount,
      taxableAmount: quote.taxableAmount,
      taxMode: quote.taxMode,
      taxLabel: quote.taxLabel,
      taxAmount: quote.taxAmount,
      cgstAmount: quote.taxBreakdown?.cgst || 0,
      sgstAmount: quote.taxBreakdown?.sgst || 0,
      igstAmount: quote.taxBreakdown?.igst || 0,
      gstAmount: quote.taxBreakdown?.gst || 0,
      payableAmount: quote.payableAmount,
      status: quote.payableAmount <= 0 ? 'free' : 'created',
      paidAt: quote.payableAmount <= 0 ? new Date() : null,
      pendingRegistration: pendingRegistrationId,
    });

    if (quote.payableAmount <= 0) {
      if (quote.discountCode) {
        await DiscountRepository.incrementUsageByCode(quote.discountCode);
      }
      await activateTenantPlanFromPayment(payment);
      const invoice = queuePaymentInvoice(payment);
      return {
        paymentId: String(payment._id),
        freeCheckout: true,
        keyId: config.razorpay.keyId || '',
        quote,
        customer: { name: customerName, email: customerEmail, phone: customerPhone },
        invoice,
        signupCompleted: Boolean(pendingRegistrationId),
      };
    }

    const razorpay = getRazorpayClient();
    const amountPaise = toPaise(quote.payableAmount);
    if (amountPaise < 100) {
      throw new AppError('Payable amount must be at least ₹1', HTTP_STATUS.BAD_REQUEST);
    }

    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: String(payment._id).slice(-12),
      notes: {
        paymentId: String(payment._id),
        planCode: plan.code,
        discountCode: quote.discountCode || '',
        taxMode: quote.taxMode || '',
      },
    });

    await PaymentRepository.updateById(payment._id, {
      razorpayOrderId: order.id,
    });

    return {
      paymentId: String(payment._id),
      freeCheckout: false,
      keyId: config.razorpay.keyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      quote,
      customer: { name: customerName, email: customerEmail, phone: customerPhone },
      signupCompleted: false,
    };
  }

  async verify(body = {}, actorOrUser = {}) {
    const user =
      actorOrUser?.user ||
      (actorOrUser?.email && !actorOrUser?.pendingRegistration ? actorOrUser : null);
    const pendingRegistration = actorOrUser?.pendingRegistration || null;

    const paymentId = body.paymentId;
    const payment = await PaymentRepository.findById(paymentId);
    if (!payment) throw new AppError('Payment not found', HTTP_STATUS.NOT_FOUND);

    const actorEmail = String(
      pendingRegistration?.email || user?.email || ''
    )
      .trim()
      .toLowerCase();
    const paymentEmail = String(payment.customerEmail || '')
      .trim()
      .toLowerCase();
    if (!actorEmail || paymentEmail !== actorEmail) {
      throw new AppError('This payment does not belong to your account', HTTP_STATUS.FORBIDDEN);
    }

    // Signup payments must keep the pendingRegistration link
    if (payment.pendingRegistration && !pendingRegistration) {
      throw new AppError(
        'Registration session required to complete this payment',
        HTTP_STATUS.FORBIDDEN
      );
    }
    if (
      payment.pendingRegistration &&
      pendingRegistration &&
      String(payment.pendingRegistration._id || payment.pendingRegistration) !==
        String(pendingRegistration._id)
    ) {
      throw new AppError('This payment does not belong to your registration', HTTP_STATUS.FORBIDDEN);
    }

    if (payment.status === 'paid' || payment.status === 'free') {
      await activateTenantPlanFromPayment(payment);
      const invoice = queuePaymentInvoice(payment);
      return {
        paymentId: String(payment._id),
        status: payment.status,
        planCode: payment.planCode,
        planName: payment.planName,
        payableAmount: payment.payableAmount,
        discountCode: payment.discountCode,
        invoice,
        signupCompleted: Boolean(payment.pendingRegistration),
      };
    }

    if (payment.payableAmount <= 0) {
      const updated = await PaymentRepository.updateById(payment._id, {
        status: 'free',
        paidAt: new Date(),
      });
      await activateTenantPlanFromPayment(updated);
      const invoice = queuePaymentInvoice(updated);
      return {
        paymentId: String(updated._id),
        status: updated.status,
        planCode: updated.planCode,
        planName: updated.planName,
        payableAmount: updated.payableAmount,
        discountCode: updated.discountCode,
        invoice,
        signupCompleted: Boolean(updated.pendingRegistration),
      };
    }

    const orderId = body.razorpay_order_id || body.razorpayOrderId;
    const razorpayPaymentId = body.razorpay_payment_id || body.razorpayPaymentId;
    const signature = body.razorpay_signature || body.razorpaySignature;

    if (!orderId || !razorpayPaymentId || !signature) {
      throw new AppError('Payment verification details are missing', HTTP_STATUS.BAD_REQUEST);
    }

    if (payment.razorpayOrderId && payment.razorpayOrderId !== orderId) {
      throw new AppError('Order mismatch', HTTP_STATUS.BAD_REQUEST);
    }

    const expected = crypto
      .createHmac('sha256', config.razorpay.keySecret)
      .update(`${orderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (expected !== signature) {
      await PaymentRepository.updateById(payment._id, { status: 'failed' });
      throw new AppError('Payment verification failed', HTTP_STATUS.BAD_REQUEST);
    }

    const updated = await PaymentRepository.updateById(payment._id, {
      status: 'paid',
      razorpayPaymentId,
      razorpaySignature: signature,
      paidAt: new Date(),
    });

    if (updated.discountCode) {
      await DiscountRepository.incrementUsageByCode(updated.discountCode);
    }

    await activateTenantPlanFromPayment(updated);
    const invoice = queuePaymentInvoice(updated);

    return {
      paymentId: String(updated._id),
      status: updated.status,
      planCode: updated.planCode,
      planName: updated.planName,
      payableAmount: updated.payableAmount,
      discountCode: updated.discountCode,
      invoice,
      signupCompleted: Boolean(updated.pendingRegistration),
    };
  }

  /**
   * Signup-only: create admin account and apply platform free trial (no Razorpay).
   */
  async startTrial(actorOrUser = {}, body = {}) {
    const pendingRegistration = actorOrUser?.pendingRegistration || null;
    if (!pendingRegistration) {
      throw new AppError(
        'Registration session required to start a free trial',
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const PlatformTrialSettingsService = require('@services/platformTrialSettings.service');
    const publicTrial = await PlatformTrialSettingsService.getPublic();
    if (!publicTrial.available || !publicTrial.plan) {
      throw new AppError(
        'Free trial is not available for public signup right now',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const AuthService = require('@services/auth.service');
    const PendingAdminRegistrationRepository = require('@repositories/pendingAdminRegistration.repository');
    const pending =
      pendingRegistration.passwordHash !== undefined
        ? pendingRegistration
        : await PendingAdminRegistrationRepository.findById(pendingRegistration._id, {
            withSecrets: true,
          });

    if (!pending) {
      throw new AppError(
        'Registration draft expired. Please register again.',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const email = String(pending.email || '')
      .trim()
      .toLowerCase();

    const reservedCode = String(body.discountCode || pending.discountCode || '')
      .trim()
      .toUpperCase();

    const plan = await resolvePlan(publicTrial.plan.id || publicTrial.plan.code);

    // Validate optional affiliate/promo code before creating the account
    if (reservedCode) {
      await quotePlan(plan, reservedCode, { customerEmail: email });
    }

    const existingUser = await UserRepository.findByEmail(email);
    let user;
    if (existingUser && !existingUser.tenant) {
      user = await AuthService.createAdminAccountFromPending(pending);
    } else if (existingUser) {
      throw new AppError(
        'An account already exists for this email. Please sign in.',
        HTTP_STATUS.CONFLICT
      );
    } else {
      user = await AuthService.createAdminAccountFromPending(pending);
    }

    const tenantId = user?.tenant?._id || user?.tenant;
    if (!tenantId) {
      throw new AppError('Unable to create shop for trial', HTTP_STATUS.INTERNAL_SERVER);
    }

    const tenant = await TenantRepository.findById(tenantId);
    if (!tenant) {
      throw new AppError('Shop not found after registration', HTTP_STATUS.INTERNAL_SERVER);
    }

    const { tenant: updated } = applyTrialPlan(tenant, {
      planName: plan.name,
      planCode: plan.code,
      catalogPricePerCycle: Number(plan.priceAmount) || 0,
      billing: plan.billing || 'Monthly',
      days: publicTrial.trialDays,
      grantedBy: null,
    });

    await TenantRepository.updateById(tenantId, {
      currentPlan: updated.currentPlan,
      pendingPlan: updated.pendingPlan,
      billingHistory: updated.billingHistory,
      subscriptionSource: updated.subscriptionSource,
      trial: updated.trial,
      reservedDiscountCode: reservedCode || '',
      status: TENANT_STATUS.ACTIVE,
    });

    const endsAt = updated.currentPlan?.endsAt || updated.trial?.endsAt || null;
    try {
      const owner = user;
      const ownerName =
        [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim() ||
        pending.firstName ||
        '';
      await sendFreeTrialStartedEmail({
        to: email,
        name: ownerName,
        shopName: updated.name || tenant.name || pending.tenantName || '',
        planName: plan.name,
        trialDays: publicTrial.trialDays,
        endsAt,
        loginUrl: `${config.frontendUrl}/`,
      });
    } catch (error) {
      console.error('[trial] Failed to email free-trial confirmation:', error.message || error);
    }

    return {
      signupCompleted: true,
      trialStarted: true,
      trialDays: publicTrial.trialDays,
      planCode: plan.code,
      planName: plan.name,
      endsAt,
      reservedDiscountCode: reservedCode || '',
    };
  }

  async getPublicConfig() {
    return {
      keyId: config.razorpay.keyId || '',
      configured: Boolean(
        config.razorpay.keyId &&
          config.razorpay.keySecret &&
          !config.razorpay.keyId.includes('replace_me') &&
          !config.razorpay.keySecret.includes('replace_me')
      ),
    };
  }
}

module.exports = new PaymentService();
