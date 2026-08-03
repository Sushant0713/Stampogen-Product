'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, BadgePercent, Loader2, Tag } from 'lucide-react';
import { paymentService } from '@/services/payment.service';
import { discountService } from '@/services/discount.service';
import { platformTrialSettingsService } from '@/services/platformTrialSettings.service';
import { getErrorMessage, getLoginPath, getRoleSlug } from '@/utils';
import { notifyClientsChanged } from '@/utils/clientsSync';
import { MARKETING_LINKS } from '@/constants/marketing';
import { useAuth } from '@/contexts/AuthContext';
import { ROLES } from '@/constants';
import { OneTimeOfferStrip } from '@/features/marketing/OneTimeOfferStrip';
import {
  clearRegistrationSession,
  getRegistrationProfile,
  getRegistrationToken,
} from '@/utils/registrationSession';
import { authService } from '@/services/auth.service';

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
  const { user, logout, refreshUser, loading: authLoading, initialized } = useAuth();
  const planCode = searchParams.get('plan') || '';
  const planId = searchParams.get('planId') || '';
  const urlDiscount = searchParams.get('discount') || '';
  const skipTrialFromUrl = searchParams.get('pay') === '1';
  const renewOutletTenantId = searchParams.get('renewOutlet') || '';
  const forOutletFromUrl =
    searchParams.get('forOutlet') === '1' || searchParams.get('forOutlet') === 'true';
  const qtyFromUrl = Math.min(50, Math.max(1, Math.floor(Number(searchParams.get('qty')) || 1)));

  const [quote, setQuote] = useState(null);
  const [seatQuantity, setSeatQuantity] = useState(qtyFromUrl);
  const [quoting, setQuoting] = useState(false);
  const seatQuantityRef = useRef(seatQuantity);
  const lastQuotedQtyRef = useRef(null);
  seatQuantityRef.current = seatQuantity;
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [paying, setPaying] = useState(false);
  const [discountInput, setDiscountInput] = useState('');
  const [appliedCode, setAppliedCode] = useState('');
  const [oneTimeOffers, setOneTimeOffers] = useState([]);
  const [registrationToken, setRegistrationToken] = useState('');
  const [signupProfile, setSignupProfile] = useState(null);
  const [signupReady, setSignupReady] = useState(false);
  const [publicTrial, setPublicTrial] = useState(null);
  const [trialDiscountCode, setTrialDiscountCode] = useState('');
  const [skipFreeTrial, setSkipFreeTrial] = useState(skipTrialFromUrl);
  const [form, setForm] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
  });
  const userClearedReservedRef = useRef(false);

  const planKey = useMemo(() => planId || planCode, [planId, planCode]);
  const roleSlug = user ? getRoleSlug(user) : null;
  const isSignupCheckout = Boolean(registrationToken && signupProfile);
  const trialAvailable = Boolean(
    isSignupCheckout &&
      publicTrial?.available &&
      publicTrial?.plan &&
      !skipFreeTrial &&
      !skipTrialFromUrl
  );
  const isRenewalCheckout =
    Boolean(user) && roleSlug === ROLES.ADMIN && Boolean(user.isEmailVerified) && !isSignupCheckout;
  const canCheckout = isSignupCheckout || isRenewalCheckout;
  const reservedDiscountCode = useMemo(() => {
    const tenant = user?.tenant && typeof user.tenant === 'object' ? user.tenant : null;
    return String(tenant?.reservedDiscountCode || '')
      .trim()
      .toUpperCase();
  }, [user]);

  // Signup: registrationToken from verify/Google. Renewal: logged-in verified admin.
  useEffect(() => {
    if (!initialized || authLoading) return;

    const token = getRegistrationToken();
    if (token) {
      const cached = getRegistrationProfile();
      setRegistrationToken(token);
      if (cached?.email) {
        setSignupProfile(cached);
        setSignupReady(true);
        return;
      }
      authService
        .getRegistrationDraft(token)
        .then(({ data }) => {
          setSignupProfile(data.data.profile);
          setSignupReady(true);
        })
        .catch(() => {
          clearRegistrationSession();
          setRegistrationToken('');
          setSignupProfile(null);
          setSignupReady(true);
          toast.error('Registration session expired. Please register again.');
          const params = new URLSearchParams();
          if (planCode || planId) params.set('plan', planCode || planId);
          if (urlDiscount) params.set('discount', urlDiscount);
          router.replace(`/admin/register?${params.toString()}`);
        });
      return;
    }

    setSignupReady(true);

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
    if (!isSignupCheckout) {
      setPublicTrial(null);
      return;
    }
    let cancelled = false;
    platformTrialSettingsService
      .getPublic()
      .then(({ data }) => {
        if (!cancelled) setPublicTrial(data?.data?.settings || null);
      })
      .catch(() => {
        if (!cancelled) setPublicTrial(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isSignupCheckout]);
  useEffect(() => {
    if (isSignupCheckout && signupProfile) {
      const fullName = [signupProfile.firstName, signupProfile.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
      const billing = signupProfile.billingProfile || {};
      setForm((prev) => ({
        ...prev,
        customerName: prev.customerName || signupProfile.tenantName || fullName,
        customerEmail: prev.customerEmail || signupProfile.email || '',
        customerPhone: prev.customerPhone || billing.phone || signupProfile.phone || '',
      }));
      return;
    }
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
  }, [user, isSignupCheckout, signupProfile]);

  const canBuyMultipleOutletSeats = Boolean(
    quote?.plan?.forOutlet && !renewOutletTenantId
  );
  const effectiveSeatQty = canBuyMultipleOutletSeats
    ? Math.min(50, Math.max(1, Math.floor(Number(seatQuantity) || 1)))
    : 1;
  const isOutletCheckout = Boolean(
    renewOutletTenantId || forOutletFromUrl || quote?.plan?.forOutlet
  );
  const backHref = isOutletCheckout
    ? renewOutletTenantId
      ? `/admin/plans/outlet/browse?renewOutlet=${encodeURIComponent(renewOutletTenantId)}`
      : '/admin/plans/outlet/browse'
    : '/pricing';
  const backLabel = isOutletCheckout ? 'Back to plan' : 'Back to pricing';

  const loadQuote = useCallback(
    async (code = '', { allowFallback = false, silent = false } = {}) => {
      if (!planKey) {
        setLoading(false);
        return;
      }
      try {
        if (silent) setQuoting(true);
        else setLoading(true);
        const billing = isSignupCheckout
          ? signupProfile?.billingProfile || {}
          : (user?.tenant && typeof user.tenant === 'object' ? user.tenant.billingProfile : null) ||
            {};
        const qty = renewOutletTenantId
          ? 1
          : Math.min(50, Math.max(1, Math.floor(Number(seatQuantityRef.current) || 1)));
        const payload = {
          ...(planId ? { planId } : { planCode }),
          ...(code ? { discountCode: code } : {}),
          customerEmail: isSignupCheckout
            ? signupProfile?.email || ''
            : user?.email || '',
          customerGstin: billing.gstin || '',
          customerState: billing.state || '',
          quantity: qty,
        };
        const { data } = await paymentService.preview(payload);
        setQuote(data.data.quote);
        lastQuotedQtyRef.current = data.data.quote?.quantity ?? qty;
        setAppliedCode(data.data.quote.discountCode || '');
        if (data.data.quote.discountCode) {
          setDiscountInput(data.data.quote.discountCode);
        }
      } catch (error) {
        if (allowFallback && code) {
          toast.error(
            getErrorMessage(
              error,
              'Saved partner code could not be applied. Continuing without it.'
            )
          );
          setDiscountInput('');
          setAppliedCode('');
          try {
            const billing = isSignupCheckout
              ? signupProfile?.billingProfile || {}
              : (user?.tenant && typeof user.tenant === 'object'
                  ? user.tenant.billingProfile
                  : null) || {};
            const qty = renewOutletTenantId
              ? 1
              : Math.min(50, Math.max(1, Math.floor(Number(seatQuantityRef.current) || 1)));
            const { data } = await paymentService.preview({
              ...(planId ? { planId } : { planCode }),
              customerEmail: isSignupCheckout
                ? signupProfile?.email || ''
                : user?.email || '',
              customerGstin: billing.gstin || '',
              customerState: billing.state || '',
              quantity: qty,
            });
            setQuote(data.data.quote);
            lastQuotedQtyRef.current = data.data.quote?.quantity ?? qty;
            setAppliedCode('');
          } catch (inner) {
            if (!silent) setQuote(null);
            toast.error(getErrorMessage(inner, 'Unable to load plan for checkout'));
          }
        } else {
          if (!silent) setQuote(null);
          toast.error(getErrorMessage(error, 'Unable to load plan for checkout'));
        }
      } finally {
        if (silent) setQuoting(false);
        else setLoading(false);
      }
    },
    [planCode, planId, planKey, user, isSignupCheckout, signupProfile, renewOutletTenantId]
  );

  // Quietly refresh totals when outlet seat quantity changes (no full-form reload).
  useEffect(() => {
    if (!initialized || authLoading || !signupReady || !canCheckout) return;
    if (trialAvailable || !planKey || renewOutletTenantId) return;
    if (!quote?.plan?.forOutlet) return;
    const qty = Math.min(50, Math.max(1, Math.floor(Number(seatQuantity) || 1)));
    if (lastQuotedQtyRef.current === qty) return;
    const code = appliedCode || '';
    const timer = setTimeout(() => {
      loadQuote(code, { silent: true });
    }, 180);
    return () => clearTimeout(timer);
  }, [
    seatQuantity,
    quote?.plan?.forOutlet,
    renewOutletTenantId,
    initialized,
    authLoading,
    signupReady,
    canCheckout,
    trialAvailable,
    planKey,
    appliedCode,
    loadQuote,
  ]);

  useEffect(() => {
    if (!initialized || authLoading || !signupReady) return;
    if (!canCheckout) return;
    if (trialAvailable) {
      setLoading(false);
      return;
    }
    if (!planKey) {
      setLoading(false);
      return;
    }

    let initialCode = '';
    let allowFallback = false;
    if (
      isRenewalCheckout &&
      reservedDiscountCode &&
      !userClearedReservedRef.current
    ) {
      initialCode = reservedDiscountCode;
      setDiscountInput(reservedDiscountCode);
      allowFallback = true;
    } else if (urlDiscount) {
      initialCode = String(urlDiscount).trim().toUpperCase();
      setDiscountInput(initialCode);
    }
    loadQuote(initialCode, { allowFallback });
  }, [
    loadQuote,
    initialized,
    authLoading,
    signupReady,
    canCheckout,
    trialAvailable,
    planKey,
    isRenewalCheckout,
    reservedDiscountCode,
    urlDiscount,
  ]);  // Prefill affiliate coupon on trial start from URL or registration draft
  useEffect(() => {
    if (!trialAvailable) return;
    const fromProfile = String(signupProfile?.discountCode || '').trim().toUpperCase();
    const fromUrl = String(urlDiscount || '').trim().toUpperCase();
    const next = fromUrl || fromProfile;
    if (next) setTrialDiscountCode(next);
  }, [trialAvailable, signupProfile, urlDiscount]);
  useEffect(() => {
    let cancelled = false;
    discountService
      .getPublic()
      .then(({ data }) => {
        if (!cancelled) setOneTimeOffers(data?.data?.discounts || []);
      })
      .catch(() => {
        if (!cancelled) setOneTimeOffers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const applyDiscount = async () => {
    const code = discountInput.trim();
    if (!code) {
      toast.error('Enter a discount code');
      return;
    }
    if (!planKey) return;
    try {
      setApplying(true);
      const billing = isSignupCheckout
        ? signupProfile?.billingProfile || {}
        : (user?.tenant && typeof user.tenant === 'object' ? user.tenant.billingProfile : null) ||
          {};
      const payload = {
        ...(planId ? { planId } : { planCode }),
        discountCode: code,
        customerEmail:
          form.customerEmail ||
          (isSignupCheckout ? signupProfile?.email : user?.email) ||
          '',
        customerGstin: billing.gstin || '',
        customerState: billing.state || '',
        quantity: renewOutletTenantId ? 1 : effectiveSeatQty,
      };
      const { data } = await paymentService.preview(payload);
      setQuote(data.data.quote);
      lastQuotedQtyRef.current = data.data.quote?.quantity ?? payload.quantity;
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
    userClearedReservedRef.current = true;
    setDiscountInput('');
    setAppliedCode('');
    await loadQuote('');
  };

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const finishSuccess = async ({ trial = false } = {}) => {
    clearRegistrationSession();
    notifyClientsChanged();

    // Logged-in admin buying a seat/plan — keep the session (signup still goes to login).
    if (isRenewalCheckout && !trial) {
      const isOutletSeat = Boolean(quote?.plan?.forOutlet);
      try {
        await refreshUser?.();
      } catch {
        // ignore — seats still load on the outlets page
      }
      if (isOutletSeat) {
        if (renewOutletTenantId) {
          toast.success('Outlet plan updated. That outlet is unlocked again.');
          window.location.assign('/admin/outlets?renewed=1');
          return;
        }
        const n = Math.max(1, Number(quote?.quantity) || effectiveSeatQty || 1);
        toast.success(
          n === 1
            ? 'Outlet seat added. Create your outlet below.'
            : `${n} outlet seats added. Create outlets from Outlets.`
        );
        window.location.assign('/admin/outlets?seat=1');
        return;
      }
      toast.success('Payment successful');
      window.location.assign('/admin/plans/my?paid=1');
      return;
    }

    try {
      if (user) await logout();
    } catch {
      // ignore logout errors
    }
    const query = trial ? 'trial=1' : 'paid=1';
    window.location.assign(`${getLoginPath(ROLES.ADMIN)}?${query}`);
  };

  const withRegistrationToken = (payload) =>
    registrationToken ? { ...payload, registrationToken } : payload;

  const billingFromActor = () => {
    if (isSignupCheckout) return signupProfile?.billingProfile || {};
    const tenant = user?.tenant && typeof user.tenant === 'object' ? user.tenant : null;
    return tenant?.billingProfile || {};
  };

  const handleStartTrial = async (event) => {
    event.preventDefault();
    if (!trialAvailable || paying || !registrationToken) return;

    try {
      setPaying(true);
      const code = String(trialDiscountCode || '').trim().toUpperCase();
      await paymentService.startTrial({
        registrationToken,
        ...(code ? { discountCode: code } : {}),
      });
      await finishSuccess({ trial: true });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to start free trial'));
    } finally {
      setPaying(false);
    }
  };

  const handleSkipFreeTrial = () => {
    const discount =
      String(urlDiscount || trialDiscountCode || '').trim().toUpperCase() || '';
    const params = new URLSearchParams();
    const nextPlan =
      planCode || planId || publicTrial?.plan?.code || publicTrial?.plan?.id || '';
    if (nextPlan) params.set('plan', nextPlan);
    if (discount) params.set('discount', discount);
    params.set('pay', '1');
    setSkipFreeTrial(true);
    router.replace(`/checkout?${params.toString()}`);
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
      const billing = billingFromActor();
      const { data } = await paymentService.createOrder(
        withRegistrationToken({
          ...(planId ? { planId } : { planCode: quote.plan.code }),
          discountCode: appliedCode || undefined,
          customerName: form.customerName.trim(),
          customerEmail: form.customerEmail.trim(),
          customerPhone: form.customerPhone.trim(),
          customerGstin: billing.gstin || '',
          customerState: billing.state || '',
          ...(renewOutletTenantId ? { renewOutletTenantId } : {}),
          ...(quote?.plan?.forOutlet && !renewOutletTenantId
            ? { quantity: effectiveSeatQty }
            : {}),
        })
      );

      const order = data.data.order;

      if (order.freeCheckout) {
        await paymentService.verify(withRegistrationToken({ paymentId: order.paymentId }));
        await finishSuccess();
        return;
      }

      const ready = await loadRazorpayScript();
      if (!ready || !window.Razorpay) {
        throw new Error('Unable to load Razorpay checkout');
      }

      const key = order.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';

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
              await paymentService.verify(
                withRegistrationToken({
                  paymentId: order.paymentId,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                })
              );
              await finishSuccess();
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

  if (!planKey && !trialAvailable) {
    // Signup: wait for public trial settings before deciding there's no plan
    if (isSignupCheckout && publicTrial === null) {
      return (
        <main className="min-h-screen" style={{ backgroundColor: COLORS.bg }}>
          <header className="border-b px-5 py-4 sm:px-8" style={{ borderColor: COLORS.line }}>
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
              <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-medium text-[#344054]">
                <ArrowLeft size={16} />
                {backLabel}
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

  if (!initialized || authLoading || !signupReady || !canCheckout) {
    return (
      <main className="min-h-screen" style={{ backgroundColor: COLORS.bg }}>
        <header className="border-b px-5 py-4 sm:px-8" style={{ borderColor: COLORS.line }}>
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-medium text-[#344054]">
              <ArrowLeft size={16} />
              {backLabel}
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
          <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-medium text-[#344054]">
            <ArrowLeft size={16} />
            {backLabel}
          </Link>
          <Image src="/logo.png" alt="Stampogen" width={140} height={36} className="h-8 w-auto object-contain" />
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 px-5 py-10 lg:grid-cols-[1.1fr_0.9fr] sm:px-8">
        <section className="rounded-2xl border bg-white p-6 shadow-sm sm:p-8" style={{ borderColor: COLORS.line }}>
          <h1 className="text-2xl font-bold tracking-tight text-[#101828]">
            {trialAvailable ? 'Start free trial' : 'Checkout'}
          </h1>
          <p className="mt-1 text-sm text-[#667085]">
            {trialAvailable
              ? `Activate your shop with a ${publicTrial.trialDays}-day free trial — no payment required.`
              : 'Complete payment to unlock your plan.'}
          </p>

          {trialAvailable ? (
            <form onSubmit={handleStartTrial} className="mt-8 space-y-5">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                Free trial on <strong>{publicTrial.plan.name}</strong> for{' '}
                <strong>{publicTrial.trialDays} days</strong>. You can upgrade anytime from My plan.
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Email</label>
                <input
                  type="email"
                  className={`${fieldClass} cursor-not-allowed bg-[#F9FAFB] text-[#667085]`}
                  value={form.customerEmail || signupProfile?.email || ''}
                  readOnly
                />
                <p className="mt-1 text-[12px] text-[#98A2B3]">
                  Your admin account is created when the trial starts
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
                  Affiliate coupon{' '}
                  <span className="font-normal text-[#98A2B3]">(optional)</span>
                </label>
                <input
                  className={fieldClass}
                  value={trialDiscountCode}
                  onChange={(e) => setTrialDiscountCode(e.target.value.toUpperCase())}
                  placeholder="Partner code"
                  maxLength={40}
                />
                <p className="mt-1 text-[12px] text-[#98A2B3]">
                  Have an affiliate partner code? We&apos;ll save it and apply it automatically when
                  you upgrade after the trial.
                </p>
              </div>
              <button
                type="submit"
                disabled={paying}
                className="inline-flex h-12 w-full items-center justify-center rounded-lg text-[15px] font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: COLORS.navy }}
              >
                {paying
                  ? 'Starting trial...'
                  : `Start ${publicTrial.trialDays}-day free trial on ${publicTrial.plan.name}`}
              </button>
              <button
                type="button"
                onClick={handleSkipFreeTrial}
                disabled={paying}
                className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-[#D0D5DD] bg-white text-[15px] font-semibold text-[#344054] transition hover:bg-[#F9FAFB] disabled:opacity-60"
              >
                Skip free trial — pay now
              </button>
            </form>
          ) : loading ? (
            <div className="mt-10 flex items-center gap-2 text-sm text-[#667085]">
              <Loader2 className="animate-spin" size={16} />
              Loading plan...
            </div>
          ) : !quote ? (
            <p className="mt-8 text-sm text-[#667085]">Unable to load this plan for checkout.</p>
          ) : (
            <form onSubmit={handlePay} className="mt-8 space-y-5">
              {canBuyMultipleOutletSeats ? (
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
                    Number of outlet seats
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="Decrease seats"
                      disabled={effectiveSeatQty <= 1 || loading || paying}
                      onClick={() => setSeatQuantity((q) => Math.max(1, (Number(q) || 1) - 1))}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#D0D5DD] text-lg font-bold text-[#344054] disabled:opacity-40"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={effectiveSeatQty}
                      onChange={(e) => {
                        const n = Math.min(50, Math.max(1, Math.floor(Number(e.target.value) || 1)));
                        setSeatQuantity(n);
                      }}
                      className={`${fieldClass} w-20 text-center`}
                    />
                    <button
                      type="button"
                      aria-label="Increase seats"
                      disabled={effectiveSeatQty >= 50 || loading || paying}
                      onClick={() => setSeatQuantity((q) => Math.min(50, (Number(q) || 1) + 1))}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#D0D5DD] text-lg font-bold text-[#344054] disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                  <p className="mt-1.5 text-[12px] text-[#98A2B3]">
                    Each seat lets you create one outlet login. You can buy up to 50 in one payment.
                  </p>
                </div>
              ) : null}
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
                    title={
                      isSignupCheckout
                        ? 'Account will be created for this email after payment'
                        : 'The plan is activated on your signed-in account'
                    }
                    placeholder="you@business.com"
                    required
                  />
                  <p className="mt-1 text-[12px] text-[#98A2B3]">
                    {isSignupCheckout
                      ? 'Your account is created only after payment succeeds'
                      : 'Billed to your signed-in account'}
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

              <OneTimeOfferStrip
                offers={oneTimeOffers}
                variant="compact"
                className="mb-3"
                onUseCode={(code) => setDiscountInput(String(code || '').toUpperCase())}
              />

              <div className="rounded-xl border border-[#EAECF0] bg-[#F9FAFB] p-4">
                <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-[#344054]">
                  <Tag size={15} />
                  Discount code
                </div>
                <p className="mb-2 text-[12px] text-[#667085]">
                  One-time and partner codes apply only on your first payment — enter the code and
                  click Apply.
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
                disabled={paying || loading || quoting}
                className="inline-flex h-12 w-full items-center justify-center rounded-lg text-[15px] font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: COLORS.red, boxShadow: '0 4px 0 #7A2A1F' }}
              >
                {paying
                  ? 'Processing...'
                  : quoting
                    ? 'Updating total...'
                    : quote.payableAmount <= 0
                      ? 'Confirm free checkout'
                      : `Pay ${formatInr(quote.payableAmount)}`}
              </button>
            </form>
          )}
        </section>

        <aside className="rounded-2xl border bg-white p-6 shadow-sm sm:p-8" style={{ borderColor: COLORS.line }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">
            {trialAvailable ? 'Trial summary' : 'Order summary'}
          </p>
          {renewOutletTenantId && !trialAvailable ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-950">
              This payment renews or changes the plan for a specific outlet (not a new unused seat).
            </p>
          ) : null}
          {trialAvailable ? (
            <div className="mt-4 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-[#101828]">{publicTrial.plan.name}</h2>
                <p className="mt-1 text-sm text-[#667085]">
                  {publicTrial.trialDays}-day free trial · {publicTrial.plan.billing || 'Monthly'} catalog
                </p>
              </div>
              <div className="space-y-2 border-t border-[#F2F4F7] pt-4 text-sm">
                <div className="flex justify-between text-[#344054]">
                  <span>Due today</span>
                  <span className="font-semibold text-emerald-700">₹0</span>
                </div>
              </div>
              <p className="text-[12px] leading-relaxed text-[#98A2B3]">
                After the trial ends you can upgrade from My plan. Your shop stays accessible with a
                soft reminder — no hard lock in this version.
              </p>
            </div>
          ) : quote ? (
            <div className={`mt-4 space-y-4 transition-opacity ${quoting ? 'opacity-60' : ''}`}>
              {quoting ? (
                <p className="inline-flex items-center gap-2 text-[12px] font-medium text-[#667085]">
                  <Loader2 className="animate-spin" size={14} />
                  Updating total…
                </p>
              ) : null}
              <div>
                <h2 className="text-xl font-bold text-[#101828]">{quote.plan.name}</h2>
                <p className="mt-1 text-sm text-[#667085]">{quote.plan.billing} billing</p>
                {quote.plan.forOutlet ? (
                  <p className="mt-1 text-sm font-semibold text-[#021A54]">
                    {quote.quantity || 1} outlet seat{(quote.quantity || 1) === 1 ? '' : 's'}
                  </p>
                ) : null}
                {quote.plan.description ? (
                  <p className="mt-3 text-sm leading-relaxed text-[#667085]">{quote.plan.description}</p>
                ) : null}
              </div>
              <div className="space-y-2 border-t border-[#F2F4F7] pt-4 text-sm">
                {quote.plan.forOutlet && (quote.quantity || 1) > 1 ? (
                  <div className="flex justify-between text-[#344054]">
                    <span>
                      {formatInr(quote.unitAmount ?? quote.plan.priceAmount)} × {quote.quantity}
                    </span>
                    <span className="font-medium">{formatInr(quote.listAmount)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-[#344054]">
                    <span>Plan price</span>
                    <span className="font-medium">{formatInr(quote.listAmount)}</span>
                  </div>
                )}
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
