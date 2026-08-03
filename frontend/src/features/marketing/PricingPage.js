'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { MARKETING_LINKS } from '@/constants/marketing';
import { planService } from '@/services/plan.service';
import { discountService } from '@/services/discount.service';
import { getErrorMessage, getRoleSlug, adminHasActivePlan } from '@/utils';
import { subscribePricingPlansChanged } from '@/utils/pricingSync';
import { getRegistrationToken } from '@/utils/registrationSession';
import { useAuth } from '@/contexts/AuthContext';
import { ROLES } from '@/constants';
import { OneTimeOfferStrip } from '@/features/marketing/OneTimeOfferStrip';

const COLORS = {
  bg: '#F1EEE3',
  ink: '#141414',
  muted: '#5C5C5C',
  navy: '#1A334D',
  red: '#B43D2E',
  card: '#F7F5EE',
  line: '#D9D4C8',
};

const NAV = [
  { label: 'Home', href: MARKETING_LINKS.home },
  { label: 'About us', href: MARKETING_LINKS.about },
  { label: 'Pricing', href: MARKETING_LINKS.pricing },
  { label: 'Affiliate Program', href: MARKETING_LINKS.affiliate },
];

function formatCardPrice(plan) {
  if (plan.priceCustom) return null;
  const amount = Number(plan.priceAmount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatMrpPrice(plan) {
  if (plan.priceCustom) return null;
  const mrp = Number(plan.mrpAmount) || 0;
  const price = Number(plan.priceAmount) || 0;
  if (mrp <= 0 || mrp <= price) return null;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(mrp);
}

function mapPlanToCard(plan, index, _plans, { canCheckout = false } = {}) {
  const featured = Boolean(plan.featuredOnWebsite);
  const badgeLabel = String(plan.badgeText || 'MOST STAMPED').trim() || 'MOST STAMPED';

  const isCustom = Boolean(plan.priceCustom);
  const isFree = !isCustom && Number(plan.priceAmount) === 0;

  const customCta = String(plan.ctaText || '').trim();
  let cta = customCta || 'Get early access';
  const planQuery = encodeURIComponent(plan.code || plan.id);
  const enabled = plan.enabled !== false;
  // Paid admin OR pending signup token → checkout; otherwise register with this plan
  let href = canCheckout
    ? `/checkout?plan=${planQuery}`
    : `/admin/register?plan=${planQuery}`;
  let variant = 'outline';

  if (isCustom) {
    cta = customCta || 'Talk to us';
    href = MARKETING_LINKS.talkToUs;
  } else if (isFree) {
    cta = customCta || 'Start free';
    href = canCheckout
      ? `/checkout?plan=${planQuery}`
      : `/admin/register?plan=${planQuery}`;
  } else if (featured) {
    variant = 'solid';
  }

  return {
    id: plan.id,
    name: plan.name,
    eyebrow: isCustom ? 'Multi-location' : null,
    mrp: formatMrpPrice(plan),
    price: formatCardPrice(plan),
    period: isCustom ? '' : plan.period || '/month',
    blurb: plan.description || '',
    features: (plan.features || [])
      .map((f) => ({
        id: f.id || f.name,
        name: f.name,
        description: String(f.description || '').trim(),
      }))
      .filter((f) => f.name),
    cta,
    href: enabled ? href : null,
    enabled,
    toastMessage: cta,
    variant,
    featured,
    badge: featured ? badgeLabel : null,
    order: index,
  };
}

function NavLink({ item }) {
  const isPricing = item.href === '/pricing';
  const className = `whitespace-nowrap text-[15px] font-normal transition-opacity hover:opacity-70 ${
    isPricing ? 'underline underline-offset-[6px]' : ''
  }`;

  if (item.href.startsWith('http') || item.href.startsWith('mailto:')) {
    return (
      <a href={item.href} className={className} style={{ color: COLORS.ink }}>
        {item.label}
      </a>
    );
  }

  if (item.href === '#') {
    return (
      <span
        className={`${className} cursor-default`}
        style={{ color: COLORS.ink }}
        title="Link coming soon"
      >
        {item.label}
      </span>
    );
  }

  return (
    <Link href={item.href} className={className} style={{ color: COLORS.ink }}>
      {item.label}
    </Link>
  );
}

function BrandMark() {
  const homeHref = MARKETING_LINKS.home === '#' ? '/pricing' : MARKETING_LINKS.home;
  const className = 'relative inline-flex shrink-0 items-center leading-none';
  const logo = (
    <Image
      src="/logo.png"
      alt="Stampogen — Stamp . Reward . Repeat"
      width={180}
      height={48}
      priority
      className="h-8 w-auto object-contain object-left sm:h-9"
    />
  );

  if (homeHref.startsWith('http')) {
    return (
      <a href={homeHref} className={className} aria-label="Stampogen home">
        {logo}
      </a>
    );
  }

  return (
    <Link href={homeHref} className={className} aria-label="Stampogen home">
      {logo}
    </Link>
  );
}

function MarketingNav() {
  return (
    <header
      className="w-full border-b"
      style={{ backgroundColor: COLORS.bg, borderColor: '#E5DFD3' }}
    >
      <div className="relative grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-2.5 sm:px-8 sm:py-3 lg:px-12 xl:px-16">
        <div className="justify-self-start">
          <BrandMark />
        </div>

        <nav className="hidden items-center justify-center gap-7 md:flex lg:gap-9">
          {NAV.map((item) => (
            <NavLink key={item.label} item={item} />
          ))}
        </nav>

        <div className="justify-self-end">
          {MARKETING_LINKS.shopOwnerLogin.startsWith('http') ? (
            <a
              href={MARKETING_LINKS.shopOwnerLogin}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90 sm:text-[13px]"
              style={{ backgroundColor: COLORS.navy }}
            >
              Login as shop owner
              <span aria-hidden>→</span>
            </a>
          ) : (
            <Link
              href={MARKETING_LINKS.shopOwnerLogin}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90 sm:text-[13px]"
              style={{ backgroundColor: COLORS.navy }}
            >
              Login as shop owner
              <span aria-hidden>→</span>
            </Link>
          )}
        </div>
      </div>

      <nav
        className="flex w-full gap-5 overflow-x-auto px-5 pb-2 md:hidden sm:px-8"
        aria-label="Mobile"
      >
        {NAV.map((item) => (
          <NavLink key={item.label} item={item} />
        ))}
      </nav>
    </header>
  );
}

const FEATURE_PREVIEW_COUNT = 5;

function FeatureRow({ feature }) {
  const [open, setOpen] = useState(false);
  const hasDescription = Boolean(feature.description);

  return (
    <li className="flex gap-2 text-[14.5px] leading-snug" style={{ color: COLORS.ink }}>
      <span className="shrink-0" style={{ color: COLORS.muted }}>
        –
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1.5">
          <span>{feature.name}</span>
          {hasDescription ? (
            <button
              type="button"
              aria-expanded={open}
              aria-label={`${open ? 'Hide' : 'Show'} details for ${feature.name}`}
              onClick={() => setOpen((prev) => !prev)}
              className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold leading-none transition hover:opacity-80"
              style={{
                color: open ? '#fff' : COLORS.navy,
                backgroundColor: open ? COLORS.navy : 'transparent',
                border: `1px solid ${COLORS.navy}`,
              }}
            >
              i
            </button>
          ) : null}
        </div>
        {open && hasDescription ? (
          <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: COLORS.muted }}>
            {feature.description}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function PlanCard({ plan }) {
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const disabledCta = plan.enabled === false;
  const hasMoreFeatures = plan.features.length > FEATURE_PREVIEW_COUNT;
  const visibleFeatures = showAllFeatures
    ? plan.features
    : plan.features.slice(0, FEATURE_PREVIEW_COUNT);

  const ctaClassName =
    'mt-8 inline-flex h-12 w-full items-center justify-center rounded-lg text-[15px] font-semibold transition hover:opacity-90';
  const ctaStyle =
    plan.variant === 'solid'
      ? {
          backgroundColor: COLORS.red,
          color: '#fff',
          boxShadow: '0 4px 0 #7A2A1F',
        }
      : {
          backgroundColor: 'transparent',
          color: COLORS.ink,
          border: `1.5px solid ${COLORS.ink}`,
        };

  const handleDisabledCta = (event) => {
    event.preventDefault();
    toast(plan.toastMessage || plan.cta || 'This plan is not available yet');
  };

  let ctaControl;
  if (disabledCta) {
    ctaControl = (
      <button type="button" onClick={handleDisabledCta} className={ctaClassName} style={ctaStyle}>
        {plan.cta}
      </button>
    );
  } else {
    const CtaTag = plan.href.startsWith('mailto:') || plan.href.startsWith('http') ? 'a' : Link;
    ctaControl = (
      <CtaTag href={plan.href} className={ctaClassName} style={ctaStyle}>
        {plan.cta}
      </CtaTag>
    );
  }

  return (
    <article
      className="relative flex h-full flex-col rounded-2xl px-7 pb-7 pt-8"
      style={{
        backgroundColor: COLORS.card,
        border: plan.featured ? `2.5px solid ${COLORS.navy}` : `1px solid ${COLORS.line}`,
        boxShadow: plan.featured
          ? '0 10px 30px rgba(26, 51, 77, 0.08)'
          : '0 6px 20px rgba(20, 20, 20, 0.04)',
      }}
    >
      {plan.featured && plan.badge ? (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 rounded px-3 py-1 text-[10px] font-bold tracking-[0.08em] text-white"
          style={{ backgroundColor: COLORS.navy }}
        >
          {plan.badge}
        </div>
      ) : null}

      {plan.eyebrow ? (
        <p className="mb-1 text-[13px] font-semibold" style={{ color: COLORS.ink }}>
          {plan.eyebrow}
        </p>
      ) : null}

      <h2
        className="font-[family-name:var(--font-outfit)] text-[28px] font-bold tracking-tight"
        style={{ color: COLORS.ink }}
      >
        {plan.name}
      </h2>

      {plan.price ? (
        <div className="mt-4">
          {plan.mrp ? (
            <p
              className="font-[family-name:var(--font-outfit)] text-[20px] font-semibold leading-none tracking-tight"
              style={{ color: COLORS.muted, textDecoration: 'line-through' }}
            >
              {plan.mrp}
            </p>
          ) : null}
          <p className={`flex flex-wrap items-baseline gap-x-1.5 gap-y-1 ${plan.mrp ? 'mt-1.5' : ''}`}>
            <span
              className="font-[family-name:var(--font-outfit)] text-[42px] font-bold leading-none tracking-tight"
              style={{ color: COLORS.ink }}
            >
              {plan.price}
            </span>
            <span className="text-[16px] font-medium" style={{ color: COLORS.muted }}>
              {plan.period}
            </span>
            <span className="text-[14px] font-medium" style={{ color: COLORS.muted }}>
              + 18% GST
            </span>
          </p>
        </div>
      ) : (
        <div className="mt-4 h-[42px]" />
      )}

      <p className="mt-4 text-[15px] leading-snug" style={{ color: COLORS.muted }}>
        {plan.blurb}
      </p>

      <ul className="mt-6 flex-1 space-y-2.5">
        {plan.features.length === 0 ? (
          <li className="text-[14.5px]" style={{ color: COLORS.muted }}>
            Features coming soon
          </li>
        ) : (
          visibleFeatures.map((feature) => <FeatureRow key={feature.id} feature={feature} />)
        )}
      </ul>

      {hasMoreFeatures ? (
        <button
          type="button"
          onClick={() => setShowAllFeatures((prev) => !prev)}
          className="mt-3 self-start text-[13px] font-semibold underline underline-offset-2 transition hover:opacity-70"
          style={{ color: COLORS.navy }}
        >
          {showAllFeatures
            ? 'View less'
            : `View more (${plan.features.length - FEATURE_PREVIEW_COUNT} more)`}
        </button>
      ) : null}

      {ctaControl}
    </article>
  );
}

export function PricingPage() {
  const { user, initialized } = useAuth();
  const [plans, setPlans] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const cached = sessionStorage.getItem('stampogen-public-plans');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const cached = sessionStorage.getItem('stampogen-public-plans');
      const parsed = cached ? JSON.parse(cached) : [];
      return !Array.isArray(parsed) || parsed.length === 0;
    } catch {
      return true;
    }
  });
  const [error, setError] = useState('');
  const [hasPendingSignup, setHasPendingSignup] = useState(false);

  useEffect(() => {
    setHasPendingSignup(Boolean(getRegistrationToken()));
  }, []);

  // Resume checkout if: paid logged-in admin (renew) OR pending signup after OTP/Google
  const canCheckout =
    hasPendingSignup ||
    (initialized &&
      Boolean(user) &&
      getRoleSlug(user) === ROLES.ADMIN &&
      Boolean(user.isEmailVerified) &&
      adminHasActivePlan(user));

  useEffect(() => {
    let cancelled = false;

    const persist = (nextPlans) => {
      try {
        sessionStorage.setItem('stampogen-public-plans', JSON.stringify(nextPlans));
      } catch {
        // ignore quota errors
      }
    };

    const loadPlans = async ({ force = false, showLoader = false } = {}) => {
      try {
        if (showLoader) {
          setLoading(true);
          setError('');
        }
        const [plansRes, discountsRes] = await Promise.all([
          planService.getPublic({ force }),
          discountService.getPublic().catch(() => null),
        ]);
        if (cancelled) return;
        const nextPlans = plansRes.data?.data?.plans || [];
        const nextDiscounts = discountsRes?.data?.data?.discounts || [];
        setPlans(nextPlans);
        setDiscounts(nextDiscounts);
        persist(nextPlans);
        setError('');
      } catch (err) {
        if (!cancelled && showLoader) {
          setError(getErrorMessage(err, 'Unable to load plans'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Always fetch fresh plans so badge / enabled flags are not stuck from session cache
    loadPlans({ force: true, showLoader: plans.length === 0 });

    const unsubscribe = subscribePricingPlansChanged(() =>
      loadPlans({ force: true, showLoader: false })
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const cards = useMemo(
    () => plans.map((plan, index) => mapPlanToCard(plan, index, plans, { canCheckout })),
    [plans, canCheckout]
  );

  return (
    <div
      className="min-h-screen font-[family-name:var(--font-dm-sans)]"
      style={{ backgroundColor: COLORS.bg, color: COLORS.ink }}
    >
      <MarketingNav />

      <main className="mx-auto max-w-[1120px] px-5 pb-20 pt-8 sm:px-8 sm:pt-12">
        <p
          className="text-[12px] font-bold uppercase tracking-[0.14em]"
          style={{ color: COLORS.red }}
        >
          Pricing
        </p>
        <h1
          className="mt-3 max-w-2xl font-[family-name:var(--font-outfit)] text-[40px] font-bold leading-[1.08] tracking-tight sm:text-[52px]"
          style={{ color: COLORS.ink }}
        >
          One plan. Unlimited stamps.
        </h1>
        <p
          className="mt-4 max-w-xl text-[17px] leading-relaxed sm:text-[18px]"
          style={{ color: COLORS.muted }}
        >
          No setup fee, no long contract. Pay more only once more than one counter needs a QR.
        </p>

        <OneTimeOfferStrip offers={discounts} />

        {loading && cards.length === 0 ? (
          <div className="mt-16 text-center text-[15px]" style={{ color: COLORS.muted }}>
            Loading plans…
          </div>
        ) : error && cards.length === 0 ? (
          <div className="mt-16 text-center text-[15px]" style={{ color: COLORS.red }}>
            {error}
          </div>
        ) : cards.length === 0 ? (
          <div className="mt-16 text-center text-[15px]" style={{ color: COLORS.muted }}>
            No plans are published yet. Enable <strong>Visible on website</strong> for a plan in
            Super Admin → Plans.
          </div>
        ) : (
          <div
            className={`mt-12 grid grid-cols-1 gap-6 md:gap-5 lg:gap-6 ${
              cards.length === 1
                ? 'md:grid-cols-1 md:max-w-md'
                : cards.length === 2
                  ? 'md:grid-cols-2'
                  : 'md:grid-cols-3'
            }`}
          >
            {cards.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
