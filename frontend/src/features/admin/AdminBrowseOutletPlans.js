'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { planService } from '@/services/plan.service';
import { getErrorMessage, cn } from '@/utils';
import { AdminPageHeader } from '@/features/admin/AdminPageShell';
import { ADMIN_ACCENT, adminCardClass } from '@/features/admin/adminTheme';

function formatInr(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);
}

export function AdminBrowseOutletPlans() {
  const searchParams = useSearchParams();
  const renewOutlet = searchParams.get('renewOutlet') || '';
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { data } = await planService.getPublic({ forOutlet: true });
        if (!cancelled) setPlans(data?.data?.plans || []);
      } catch (error) {
        if (!cancelled) {
          toast.error(getErrorMessage(error, 'Unable to load outlet plans'));
          setPlans([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const checkoutHref = (plan) => {
    const code = plan.code || plan.id;
    const params = new URLSearchParams({ plan: String(code), forOutlet: '1' });
    if (renewOutlet) params.set('renewOutlet', renewOutlet);
    return `/checkout?${params.toString()}`;
  };

  return (
    <div className="mx-auto w-full max-w-5xl lg:max-w-none">
      <AdminPageHeader
        title={renewOutlet ? 'Change outlet plan' : 'Browse outlet plans'}
        subtitle={
          renewOutlet
            ? 'Pick a plan to renew or change for this outlet. Payment updates that outlet only.'
            : 'Buy one or more outlet seats in checkout (set quantity there). Then create an outlet login for each seat from Outlets.'
        }
      />

      {renewOutlet ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Renewing a specific outlet. Prefer the same plan to extend, or pick another to change.
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap justify-end gap-3">
        <Link href="/admin/outlets" className="text-sm font-bold text-[#021A54] hover:underline">
          My outlets
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-sm text-[#667085]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading outlet plans…
        </div>
      ) : plans.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#E5E7EB] bg-white px-4 py-10 text-center text-sm text-[#667085]">
          No outlet plans are published yet. Ask Super Admin to enable “Plan for outlet” on a plan.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCustom = Boolean(plan.priceCustom);
            const href = isCustom ? 'mailto:hello@stampogen.com' : checkoutHref(plan);

            return (
              <div key={plan.id || plan.code} className={cn(adminCardClass('flex flex-col p-5'))}>
                <span className="inline-flex w-fit rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-bold text-[#021A54]">
                  Outlet seat
                </span>
                <h2 className="mt-2 text-lg font-extrabold text-[#101828]">{plan.name}</h2>
                <p className="mt-1 text-[13px] text-[#667085]">{plan.billing} billing · 1 outlet</p>
                <p className="mt-4 text-2xl font-extrabold text-[#101828]">
                  {isCustom ? 'Custom' : formatInr(plan.priceAmount)}
                </p>
                {plan.description ? (
                  <p className="mt-2 flex-1 text-[13px] leading-relaxed text-[#667085]">
                    {plan.description}
                  </p>
                ) : (
                  <div className="flex-1" />
                )}
                <Link
                  href={href}
                  className="mt-5 inline-flex h-11 items-center justify-center rounded-xl text-sm font-bold text-white"
                  style={{ backgroundColor: ADMIN_ACCENT }}
                >
                  {isCustom
                    ? plan.ctaText || 'Talk to us'
                    : renewOutlet
                      ? 'Select plan'
                      : plan.ctaText || 'Buy seats'}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
