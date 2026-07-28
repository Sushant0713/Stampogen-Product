const {
  normalizeInvoicePrefix,
} = require('@helpers/invoiceSettings.helper');
const { resolveTaxMode, calcLineTax } = require('@helpers/gstTax.helper');

function parseInvoiceNumber(value) {
  const match = String(value || '')
    .trim()
    .toUpperCase()
    .match(/^([A-Z0-9]{1,10})-(\d{4})-(\d{1,5})$/);
  if (!match) return null;
  return {
    prefix: match[1],
    year: Number(match[2]),
    sequence: Number(match[3]),
  };
}

function formatInvoiceId({ prefix, year, sequence }) {
  const p = normalizeInvoicePrefix(prefix);
  const y = Number(year);
  const safeYear = Number.isFinite(y) && y >= 2000 && y <= 2100 ? y : new Date().getFullYear();
  const rawSeq = Number(sequence);
  const seq = Number.isFinite(rawSeq) ? Math.max(1, Math.min(99999, Math.floor(rawSeq))) : 1;
  return `${p}-${safeYear}-${String(seq).padStart(5, '0')}`;
}

function formatMoney(amount = 0) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

function financialYearLabel(dateValue) {
  const d = dateValue ? new Date(dateValue) : new Date();
  if (Number.isNaN(d.getTime())) {
    const y = new Date().getFullYear();
    return `${y}-${String(y + 1).slice(-2)}`;
  }
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-based; FY starts April (3)
  const start = month >= 3 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

function formatDisplayDate(dateValue) {
  const d = dateValue ? new Date(dateValue) : new Date();
  if (Number.isNaN(d.getTime())) return String(dateValue || '');
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function nextInvoiceMeta(settingsView) {
  const defaults = settingsView.defaults || {};
  const prefix = normalizeInvoicePrefix(defaults.invoicePrefix);
  const today = new Date();
  const invoiceDate = today.toISOString().slice(0, 10);
  const year = today.getFullYear();
  const parsed = parseInvoiceNumber(defaults.sampleInvoiceNumber);
  const currentSeq = parsed?.sequence || 0;
  const sequence = currentSeq + 1;
  const invoiceNumber = formatInvoiceId({ prefix, year, sequence });
  return { prefix, invoiceDate, year, sequence, invoiceNumber };
}

function resolveCustomer({ tenant, payment = null, customerOverride = null }) {
  const owner = tenant?.owner || {};
  const settings = tenant?.settings && typeof tenant.settings === 'object' ? tenant.settings : {};
  const billing =
    tenant?.billingProfile && typeof tenant.billingProfile === 'object'
      ? tenant.billingProfile
      : {};
  const override = customerOverride && typeof customerOverride === 'object' ? customerOverride : {};
  const pay = payment && typeof payment === 'object' ? payment : {};

  const ownerName =
    owner.fullName ||
    `${owner.firstName || ''} ${owner.lastName || ''}`.trim();

  const name =
    override.name ||
    tenant?.name ||
    pay.customerName ||
    ownerName ||
    'Customer';

  const email =
    override.email ||
    owner.email ||
    pay.customerEmail ||
    '';

  const phone =
    override.phone ||
    billing.phone ||
    pay.customerPhone ||
    owner.phone ||
    settings.phone ||
    settings.billingPhone ||
    '';

  const composedBillingAddress = [
    billing.street,
    [billing.city, billing.state].filter(Boolean).join(', '),
    billing.pin ? `PIN ${billing.pin}` : '',
  ]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join('\n');

  const address =
    override.address ||
    billing.address ||
    composedBillingAddress ||
    settings.billingAddress ||
    settings.address ||
    owner.address ||
    '';

  const gstin =
    override.gstin ||
    billing.gstin ||
    tenant?.gstin ||
    settings.gstin ||
    owner.gstin ||
    '';

  const pan = override.pan || billing.pan || settings.pan || owner.pan || '';

  return {
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    phone: String(phone).trim(),
    address: String(address).trim(),
    gstin: String(gstin).trim().toUpperCase(),
    pan: String(pan).trim().toUpperCase(),
    state: String(override.state || billing.state || '').trim(),
    organization: String(tenant?.name || '').trim(),
    contactName: String(ownerName || pay.customerName || '').trim(),
  };
}

function buildPlanChangeInvoice({
  settingsView,
  tenant,
  planName,
  pricePerCycle,
  payment = null,
  customerOverride = null,
  introText = null,
}) {
  const settings = settingsView;
  const defaults = settings.defaults || {};
  const meta = nextInvoiceMeta(settings);
  const dueDays = Number(defaults.dueDays) || 30;
  const dueDate = new Date(meta.invoiceDate);
  dueDate.setDate(dueDate.getDate() + dueDays);

  const customer = resolveCustomer({ tenant, payment, customerOverride });

  const taxMode =
    payment?.taxMode ||
    resolveTaxMode({
      companyGstin: settings.company?.gstin,
      customerGstin: customer.gstin,
      companyState: settings.company?.address,
      customerState: customer.state,
    }) ||
    defaults.taxMode ||
    'igst';

  const listAmount = Number(
    payment?.listAmount != null ? payment.listAmount : pricePerCycle
  ) || 0;
  const discountAmount = Math.max(0, Number(payment?.discountAmount) || 0);
  const taxable = Math.max(
    0,
    payment?.taxableAmount != null
      ? Number(payment.taxableAmount)
      : listAmount - discountAmount
  );

  let tax;
  if (
    payment &&
    payment.taxAmount != null &&
    payment.payableAmount != null &&
    Number(payment.payableAmount) >= 0
  ) {
    const breakdown = {
      gst: Number(payment.gstAmount) || 0,
      cgst: Number(payment.cgstAmount) || 0,
      sgst: Number(payment.sgstAmount) || 0,
      igst: Number(payment.igstAmount) || 0,
    };
    tax = {
      taxLabel: payment.taxLabel || `Tax (${taxMode})`,
      taxAmt: Number(payment.taxAmount) || 0,
      total: Number(payment.payableAmount) || taxable,
      breakdown,
    };
  } else {
    tax = calcLineTax({
      taxable,
      taxMode,
      gstRate: defaults.gstRate,
      igstRate: defaults.igstRate,
      sgstRate: defaults.sgstRate,
      cgstRate: defaults.cgstRate,
    });
  }

  const billingLabel = payment?.billing ? ` · ${payment.billing}` : '';

  return {
    meta,
    dueDate: dueDate.toISOString().slice(0, 10),
    company: settings.company,
    customer,
    billToTitle: defaults.billToTitle || 'Bill To',
    payment: settings.payment,
    terms: settings.terms || [],
    closingNote: settings.closingNote || 'Thank you for your business',
    introText:
      introText ||
      (payment
        ? 'Thank you for your payment. Here is your invoice:'
        : 'Your plan has been updated. Here is your invoice:'),
    taxMode,
    item: {
      name: `Stampogen ${planName} Plan${billingLabel}`,
      rate: listAmount,
      units: 1,
      discount: discountAmount,
      taxable,
      taxLabel: tax.taxLabel,
      taxAmt: tax.taxAmt,
      total: tax.total,
    },
    totals: {
      taxable,
      discount: discountAmount,
      tax: tax.taxAmt,
      total: tax.total,
      breakdown: tax.breakdown || { gst: 0, cgst: 0, sgst: 0, igst: 0 },
    },
    planName,
    billingCycle: payment?.billing || '',
    financialYear: financialYearLabel(meta.invoiceDate),
    displayDate: formatDisplayDate(meta.invoiceDate),
    paymentRef: payment
      ? {
          id: String(payment._id || payment.id || ''),
          status: payment.status || '',
          razorpayPaymentId: payment.razorpayPaymentId || '',
          discountCode: payment.discountCode || '',
        }
      : null,
  };
}

function taxIncludingPhrase(totals) {
  const b = totals?.breakdown || {};
  const parts = [];
  if (Number(b.cgst) > 0) parts.push(`CGST ${formatMoney(b.cgst)}`);
  if (Number(b.sgst) > 0) parts.push(`SGST ${formatMoney(b.sgst)}`);
  if (Number(b.igst) > 0) parts.push(`IGST ${formatMoney(b.igst)}`);
  if (Number(b.gst) > 0) parts.push(`GST ${formatMoney(b.gst)}`);
  if (!parts.length && Number(totals?.tax) > 0) {
    parts.push(`tax ${formatMoney(totals.tax)}`);
  }
  return parts.length ? ` (including ${parts.join(' and ')})` : '';
}

function greetingName(customer = {}) {
  return (
    customer.contactName ||
    customer.name ||
    'Customer'
  )
    .trim()
    .toUpperCase();
}

function issuedToName(customer = {}) {
  return customer.organization || customer.name || 'your account';
}

function planDescription(invoice) {
  const plan = String(invoice.planName || 'Plan').trim();
  const cycle = String(invoice.billingCycle || '').trim();
  const base = /plan$/i.test(plan) ? plan : `${plan} plan`;
  if (cycle) {
    return `${base} (${cycle.toLowerCase()} billing)`;
  }
  return base;
}

function buildInvoiceEmailCopy(invoice, { paymentsUrl = '', pdfFileName = '' } = {}) {
  const company = invoice.company || {};
  const customer = invoice.customer || {};
  const meta = invoice.meta || {};
  const totals = invoice.totals || {};
  const dear = greetingName(customer);
  const org = issuedToName(customer);
  const planDesc = planDescription(invoice);
  const displayDate = invoice.displayDate || formatDisplayDate(meta.invoiceDate);
  const fy = invoice.financialYear || financialYearLabel(meta.invoiceDate);
  const totalLabel = formatMoney(totals.total);
  const taxPhrase = taxIncludingPhrase(totals);
  const fileName = pdfFileName || `${meta.invoiceNumber || 'invoice'}.pdf`;
  const companyName = company.name || 'Stampogen';
  const supportEmail = company.email || 'billing@stampogen.com';
  const supportPhone = company.phone || '';
  const historyLine = paymentsUrl
    ? `You may also view your payment history online at ${paymentsUrl}.`
    : '';
  const supportLine = supportPhone
    ? `For billing queries or subscription support, please email us at ${supportEmail} or call ${supportPhone}.`
    : `For billing queries or subscription support, please email us at ${supportEmail}.`;

  const paragraphs = [
    `Dear ${dear},`,
    `Please find attached your subscription tax invoice (Invoice No. ${meta.invoiceNumber}) dated ${displayDate} for Financial Year ${fy}, issued to ${org} for the ${planDesc}.`,
    `We confirm receipt of ${totalLabel}${taxPhrase} against the above invoice. The invoice is attached to this email as ${fileName}. Please use a PDF reader to open the attachment.`,
    'Subscription services will continue as per the selected billing cycle.',
    historyLine,
    supportLine,
    'With best regards,',
    `Team ${companyName}`,
  ].filter(Boolean);

  const text = [
    ...paragraphs,
    '',
    `Please note: This is a computer-generated email. Please do not reply to this message.${
      company.gstin ? ` ${companyName} · GSTIN ${company.gstin}` : ''
    }`,
  ].join('\n\n');

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 640px; margin: 0 auto; color: #101828; line-height: 1.55; font-size: 14px;">
      <div style="background: #021A54; color: #fff; padding: 18px 24px;">
        <p style="margin: 0; font-size: 18px; font-weight: 700;">${companyName}</p>
        <p style="margin: 6px 0 0; opacity: 0.85; font-size: 13px;">Subscription tax invoice ${meta.invoiceNumber || ''}</p>
      </div>
      <div style="border: 1px solid #E5E7EB; border-top: 0; padding: 28px 24px;">
        ${paragraphs
          .map((p) => {
            if (p.startsWith('Dear ')) {
              return `<p style="margin: 0 0 16px;">${p}</p>`;
            }
            if (p.startsWith('With best regards')) {
              return `<p style="margin: 24px 0 4px;">${p}</p>`;
            }
            if (p.startsWith('Team ')) {
              return `<p style="margin: 0 0 8px; font-weight: 600;">${p}</p>`;
            }
            return `<p style="margin: 0 0 14px;">${p}</p>`;
          })
          .join('')}
        <p style="margin: 28px 0 0; padding-top: 16px; border-top: 1px solid #EEF2F6; font-size: 12px; color: #667085;">
          Please note: This is a computer-generated email. Please do not reply to this message.${
            company.gstin
              ? `<br/>${companyName} · GSTIN ${company.gstin}`
              : ''
          }
        </p>
      </div>
    </div>
  `;

  return {
    subject: `Subscription tax invoice ${meta.invoiceNumber}`,
    text,
    html,
    pdfFileName: fileName,
  };
}

/** @deprecated use buildInvoiceEmailCopy — kept for callers expecting HTML only */
function buildInvoiceEmailHtml(invoice, options = {}) {
  return buildInvoiceEmailCopy(invoice, options).html;
}

module.exports = {
  parseInvoiceNumber,
  formatInvoiceId,
  nextInvoiceMeta,
  resolveCustomer,
  buildPlanChangeInvoice,
  buildInvoiceEmailHtml,
  buildInvoiceEmailCopy,
  formatMoney,
  financialYearLabel,
  formatDisplayDate,
};
