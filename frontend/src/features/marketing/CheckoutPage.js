'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, BadgePercent, Loader2, Tag } from 'lucide-react';
import { paymentService } from '@/services/payment.service';
import { getErrorMessage, getLoginPath, getRoleSlug } from '@/utils';
import { notifyClientsChanged } from '@/utils/clientsSync';
import { MARKETING_LINKS } from '@/constants/marketing';
import { useAuth } from '@/contexts/AuthContext';
import { ROLES } from '@/constants';

const COLORS = {
  bg: '#F7F3EB',
  card: '#FFFFFF',
  ink: '#1A1A1A',
  muted: '#6B6B6B',
  navy: '#021A54',
  red: '#B23B2B',
  line: '#E5DFD3',
};

const fieldClass =
  'h-12 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none placeholder:text-[#98A2B3] focus:border-[#021A54] focus:ring-1 focus:ring-[#021A54]';

function formatInr(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutPageInner />
    </Suspense>
  );
}

function CheckoutPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, logout, loading: authLoading, initialized } = useAuth();
  const planCode = searchParams.get('plan') || '';
  const planId = searchParams.get('planId') || '';
  const urlDiscount = searchParams.get('discount') || '';

  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [paying, setPaying] = useState(false);
  const [discountInput, setDiscountInput] = useState('');
  const [appliedCode, setAppliedCode] = useState('');
  const [form, setForm] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
  });

  const planKey = useMemo(() => planId || planCode, [planId, planCode]);
  const roleSlug = user ? getRoleSlug(user) : null;

  // Must be a registered, verified admin before paying for a plan
  useEffect(() => {
    // Wait until /auth/me has finished — never treat "initialized without user" as logged out mid-fetch
    if (!initialized || authLoading) return;
    if (!planKey) return;

    if (!user) {
      const plan = planCode || planId;
      const params = new URLSearchParams();
      if (plan) params.set('plan', plan);
      if (urlDiscount) params.set('discount', urlDiscount);
      router.replace(`/admin/register?${params.toString()}`);
      return;
    }

    if (roleSlug !== ROLES.ADMIN) {
      toast.error('Please sign in with an admin account to continue checkout');
      router.replace(getLoginPath(ROLES.ADMIN));
      return;
    }

    if (!user.isEmailVerified) {
      const params = new URLSearchParams({ email: user.email || '' });
      if (planCode) params.set('plan', planCode);
      if (urlDiscount) params.set('discount', urlDiscount);
      toast('Please verify your email before payment');
      router.replace(`/admin/verify-email?${params.toString()}`);
    }
  }, [initialized, authLoading, user, roleSlug, planKey, planCode, planId, urlDiscount, router]);

  useEffect(() => {
    if (!user) return;
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    const tenant = user.tenant && typeof user.tenant === 'object' ? user.tenant : null;
    const billing = tenant?.billingProfile || {};
    setForm((prev) => ({
      ...prev,
      customerName: prev.customerName || tenant?.name || fullName,
      customerEmail: prev.customerEmail || user.email || '',
      customerPhone: prev.customerPhone || billing.phone || user.phone || '',
    }));
  }, [user]);

  const loadQuote = useCallback(
    async (code = '') => {
      if (!planKey) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const tenant = user?.tenant && typeof user.tenant === 'object' ? user.tenant : null;
        const billing = tenant?.billingProfile || {};
        const payload = {
          ...(planId ? { planId } : { planCode }),
          ...(code ? { discountCode: code } : {}),
          customerEmail: user?.email || '',
          customerGstin: billing.gstin || '',
          customerState: billing.state || billing.address || '',
        };
        const { data } = await paymentService.preview(payload);
        setQuote(data.data.quote);
        setAppliedCode(data.data.quote.discountCode || '');
        if (data.data.quote.discountCode) {
          setDiscountInput(data.data.quote.discountCode);
        }
      } catch (error) {
        setQuote(null);
        toast.error(getErrorMessage(error, 'Unable to load plan for checkout'));
      } finally {
        setLoading(false);
      }
    },
    [planCode, planId, planKey, user]
  );

  useEffect(() => {
    if (!initialized || authLoading) return;
    if (!user || roleSlug !== ROLES.ADMIN || !user.isEmailVerified) return;
    // Quote full selling price; customer applies coupon manually at checkout
    loadQuote('');
  }, [loadQuote, initialized, authLoading, user, roleSlug]);

  const applyDiscount = async () => {
    const code = discountInput.trim();
    if (!code) {
      toast.error('Enter a discount code');
      return;
    }
    if (!planKey) return;
    try {
      setApplying(true);
      const tenant = user?.tenant && typeof user.tenant === 'object' ? user.tenant : null;
      const billing = tenant?.billingProfile || {};
      const payload = {
        ...(planId ? { planId } : { planCode }),
        discountCode: code,
        customerEmail: form.customerEmail || user?.email || '',
        customerGstin: billing.gstin || '',
        customerState: billing.state || billing.address || '',
      };
      const { data } = await paymentService.preview(payload);
      setQuote(data.data.quote);
      setAppliedCode(data.data.quote.discountCode || '');
      setDiscountInput(data.data.quote.discountCode || code);
      toast.success('Discount applied');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to apply discount'));
    } finally {
      setApplying(false);
    }
  };

  const clearDiscount = async () => {
    setDiscountInput('');
    setAppliedCode('');
    await loadQuote('');
  };

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const finishSuccess = async (payment) => {
    // Login page shows a single "payment complete" toast via ?paid=1
    notifyClientsChanged();
    try {
      await logout();
    } catch {
      // ignore logout errors
    }
    window.location.assign(`${getLoginPath(ROLES.ADMIN)}?paid=1`);
  };

  const handlePay = async (event) => {
    event.preventDefault();
    if (!quote || paying) return;

    if (!form.customerName.trim() || !form.customerEmail.trim()) {
      toast.error('Name and email are required');
      return;
    }

    try {
      setPaying(true);
      const { data } = await paymentService.createOrder({
        ...(planId ? { planId } : { planCode: quote.plan.code }),
        discountCode: appliedCode || undefined,
        customerName: form.customerName.trim(),
        customerEmail: form.customerEmail.trim(),
        customerPhone: form.customerPhone.trim(),
        customerGstin: (() => {
          const tenant = user?.tenant && typeof user.tenant === 'object' ? user.tenant : null;
          return tenant?.billingProfile?.gstin || '';
        })(),
        customerState: (() => {
          const tenant = user?.tenant && typeof user.tenant === 'object' ? user.tenant : null;
          const billing = tenant?.billingProfile || {};
          return billing.state || billing.address || '';
        })(),
      });

      const order = data.data.order;

      if (order.freeCheckout) {
        const verifyRes = await paymentService.verify({ paymentId: order.paymentId });
        await finishSuccess(verifyRes.data.data.payment);
        return;
      }

      const ready = await loadRazorpayScript();
      if (!ready || !window.Razorpay) {
        throw new Error('Unable to load Razorpay checkout');
      }

      const key =
        order.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';

      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key,
          amount: order.amount,
          currency: order.currency || 'INR',
          name: 'Stampogen',
          description: `${order.quote.plan.name} plan`,
          order_id: order.orderId,
          prefill: {
            name: form.customerName.trim(),
            email: form.customerEmail.trim(),
            contact: form.customerPhone.trim(),
          },
          theme: { color: COLORS.navy },
          handler: async (response) => {
            try {
              const verifyRes = await paymentService.verify({
                paymentId: order.paymentId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              await finishSuccess(verifyRes.data.data.payment);
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          modal: {
            ondismiss: () => {
              setPaying(false);
              resolve();
            },
          },
        });

        rzp.on('payment.failed', (response) => {
          toast.error(response?.error?.description || 'Payment failed');
          reject(new Error(response?.error?.description || 'Payment failed'));
        });

        rzp.open();
      });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to start payment'));
    } finally {
      setPaying(false);
    }
  };

  if (!planKey) {
    return (
      <main className="min-h-screen px-5 py-16" style={{ backgroundColor: COLORS.bg }}>
        <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-[#101828]">No plan selected</p>
          <p className="mt-2 text-sm text-[#667085]">Pick a plan from the pricing page to continue.</p>
          <Link
            href={MARKETING_LINKS.pricing}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold text-white"
            style={{ backgroundColor: COLORS.navy }}
          >
            View pricing
          </Link>
        </div>
      </main>
    );
  }

  if (!initialized || authLoading || !user || roleSlug !== ROLES.ADMIN || !user.isEmailVerified) {
    return (
      <main className="min-h-screen" style={{ backgroundColor: COLORS.bg }}>
        <header className="border-b px-5 py-4 sm:px-8" style={{ borderColor: COLORS.line }}>
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <Link href="/pricing" className="inline-flex items-center gap-2 text-sm font-medium text-[#344054]">
              <ArrowLeft size={16} />
              Back to pricing
            </Link>
            <Image src="/logo.png" alt="Stampogen" width={140} height={36} className="h-8 w-auto object-contain" />
          </div>
        </header>
        <div className="flex items-center justify-center px-5 py-24">
          <div className="inline-flex items-center gap-2 text-sm text-[#667085]">
            <Loader2 className="animate-spin" size={16} />
            Preparing checkout...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: COLORS.bg }}>
      <header className="border-b px-5 py-4 sm:px-8" style={{ borderColor: COLORS.line }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <Link href="/pricing" className="inline-flex items-center gap-2 text-sm font-medium text-[#344054]">
            <ArrowLeft size={16} />
            Back to pricing
          </Link>
          <Image src="/logo.png" alt="Stampogen" width={140} height={36} className="h-8 w-auto object-contain" />
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 px-5 py-10 lg:grid-cols-[1.1fr_0.9fr] sm:px-8">
        <section className="rounded-2xl border bg-white p-6 shadow-sm sm:p-8" style={{ borderColor: COLORS.line }}>
          <h1 className="text-2xl font-bold tracking-tight text-[#101828]">Checkout</h1>
          <p className="mt-1 text-sm text-[#667085]">Complete payment to unlock your plan.</p>

          {loading ? (
            <div className="mt-10 flex items-center gap-2 text-sm text-[#667085]">
              <Loader2 className="animate-spin" size={16} />
              Loading plan...
            </div>
          ) : !quote ? (
            <p className="mt-8 text-sm text-[#667085]">Unable to load this plan for checkout.</p>
          ) : (
            <form onSubmit={handlePay} className="mt-8 space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Full name</label>
                  <input
                    className={fieldClass}
                    value={form.customerName}
                    onChange={(e) => update('customerName', e.target.value)}
                    placeholder="Your name"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Email</label>
                  <input
                    type="email"
                    className={`${fieldClass} cursor-not-allowed bg-[#F9FAFB] text-[#667085]`}
                    value={form.customerEmail}
                    readOnly
                    title="The plan is activated on your signed-in account"
                    placeholder="you@business.com"
                    required
                  />
                  <p className="mt-1 text-[12px] text-[#98A2B3]">
                    Billed to your signed-in account
                  </p>
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
                    Phone <span className="font-normal text-[#98A2B3]">(optional)</span>
                  </label>
                  <input
                    className={fieldClass}
                    value={form.customerPhone}
                    onChange={(e) => update('customerPhone', e.target.value)}
                    placeholder="10-digit mobile"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-[#EAECF0] bg-[#F9FAFB] p-4">
                <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-[#344054]">
                  <Tag size={15} />
                  Discount code
                </div>
                <p className="mb-2 text-[12px] text-[#667085]">
                  Partner / affiliate codes apply only on your first payment.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    className={fieldClass}
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value.toUpperCase())}
                    placeholder="Enter promo code"
                  />
                  <button
                    type="button"
                    onClick={applyDiscount}
                    disabled={applying}
                    className="inline-flex h-12 shrink-0 items-center justify-center rounded-lg border border-[#021A54] px-4 text-sm font-semibold text-[#021A54] transition hover:bg-[#F5F8FF] disabled:opacity-60"
                  >
                    {applying ? 'Applying...' : 'Apply'}
                  </button>
                </div>
                {appliedCode ? (
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm text-emerald-700">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <BadgePercent size={14} />
                      {appliedCode} applied (−{formatInr(quote.discountAmount)})
                    </span>
                    <button type="button" onClick={clearDiscount} className="font-semibold text-[#667085] hover:text-[#101828]">
                      Remove
                    </button>
                  </div>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={paying || loading}
                className="inline-flex h-12 w-full items-center justify-center rounded-lg text-[15px] font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: COLORS.red, boxShadow: '0 4px 0 #7A2A1F' }}
              >
                {paying
                  ? 'Processing...'
                  : quote.payableAmount <= 0
                    ? 'Confirm free checkout'
                    : `Pay ${formatInr(quote.payableAmount)}`}
              </button>
            </form>
          )}
        </section>

        <aside className="rounded-2xl border bg-white p-6 shadow-sm sm:p-8" style={{ borderColor: COLORS.line }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">Order summary</p>
          {quote ? (
            <div className="mt-4 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-[#101828]">{quote.plan.name}</h2>
                <p className="mt-1 text-sm text-[#667085]">{quote.plan.billing} billing</p>
                {quote.plan.description ? (
                  <p className="mt-3 text-sm leading-relaxed text-[#667085]">{quote.plan.description}</p>
                ) : null}
              </div>
              <div className="space-y-2 border-t border-[#F2F4F7] pt-4 text-sm">
                <div className="flex justify-between text-[#344054]">
                  <span>Plan price</span>
                  <span className="font-medium">{formatInr(quote.listAmount)}</span>
                </div>
                <div className="flex justify-between text-[#344054]">
                  <span>Discount</span>
                  <span className="font-medium text-emerald-700">
                    {quote.discountAmount > 0 ? `−${formatInr(quote.discountAmount)}` : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-[#344054]">
                  <span>Taxable amount</span>
                  <span className="font-medium">
                    {formatInr(quote.taxableAmount ?? quote.listAmount - (quote.discountAmount || 0))}
                  </span>
                </div>
                {quote.taxMode === 'sgst_cgst' ? (
                  <>
                    <div className="flex justify-between text-[#344054]">
                      <span>
                        CGST
                        {quote.taxRates?.cgst != null ? ` (${quote.taxRates.cgst}%)` : ''}
                      </span>
                      <span className="font-medium">
                        {formatInr(quote.taxBreakdown?.cgst || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[#344054]">
                      <span>
                        SGST
                        {quote.taxRates?.sgst != null ? ` (${quote.taxRates.sgst}%)` : ''}
                      </span>
                      <span className="font-medium">
                        {formatInr(quote.taxBreakdown?.sgst || 0)}
                      </span>
                    </div>
                  </>
                ) : quote.taxMode === 'gst' ? (
                  <div className="flex justify-between text-[#344054]">
                    <span>
                      GST
                      {quote.taxRates?.gst != null ? ` (${quote.taxRates.gst}%)` : ''}
                    </span>
                    <span className="font-medium">{formatInr(quote.taxBreakdown?.gst || 0)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-[#344054]">
                    <span>
                      IGST
                      {quote.taxRates?.igst != null ? ` (${quote.taxRates.igst}%)` : ''}
                    </span>
                    <span className="font-medium">{formatInr(quote.taxBreakdown?.igst || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-[#F2F4F7] pt-3 text-base font-semibold text-[#101828]">
                  <span>Total due</span>
                  <span>{formatInr(quote.payableAmount)}</span>
                </div>
                {quote.customerTax?.state || quote.taxLabel ? (
                  <p className="text-[12px] leading-relaxed text-[#98A2B3]">
                    {quote.taxMode === 'sgst_cgst'
                      ? 'Same state as Stampogen → CGST + SGST'
                      : quote.taxMode === 'igst'
                        ? 'Other state → IGST'
                        : quote.taxLabel}
                    {quote.customerTax?.state ? ` · ${quote.customerTax.state}` : ''}
                  </p>
                ) : null}
              </div>
              <p className="text-[12px] leading-relaxed text-[#98A2B3]">
                Payments are processed securely by Razorpay. After payment, sign in with the password
                you created at registration.
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[#667085]">{loading ? 'Loading...' : 'No quote yet'}</p>
          )}
        </aside>
      </div>
    </main>
  );
}
