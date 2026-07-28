'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { planService } from '@/services/plan.service';
import { useAuth } from '@/contexts/AuthContext';
import { getErrorMessage, cn } from '@/utils';
import { MARKETING_LINKS } from '@/constants/marketing';
import { AdminPageHeader } from '@/features/admin/AdminPageShell';
import { ADMIN_ACCENT, adminCardClass } from '@/features/admin/adminTheme';

function formatInr(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);
}

export function AdminBrowsePlans() {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentName = user?.subscription?.planName || user?.tenant?.subscription?.planName || '';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { data } = await planService.getPublic();
        if (!cancelled) setPlans(data?.data?.plans || []);
      } catch (error) {
        if (!cancelled) {
          toast.error(getErrorMessage(error, 'Unable to load plans'));
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

  return (
    <div className="mx-auto w-full max-w-5xl lg:max-w-none">
      <AdminPageHeader
        title="Browse plans"
        subtitle="Choose a plan to upgrade or renew. Checkout uses your logged-in admin account."
      />
      <div className="mb-4 flex justify-end">
        <Link href="/admin/plans/my" className="text-sm font-bold text-[#021A54] hover:underline">
          ← My plan
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-sm text-[#667085]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading plans…
        </div>
      ) : plans.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#E5E7EB] bg-white px-4 py-10 text-center text-sm text-[#667085]">
          No plans available right now.{' '}
          <Link href={MARKETING_LINKS.pricing} className="font-bold text-[#021A54]">
            Open pricing page
          </Link>
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent =
              currentName &&
              String(plan.name || '').toLowerCase() === String(currentName).toLowerCase();
            const isCustom = Boolean(plan.priceCustom);
            const href = isCustom
              ? MARKETING_LINKS.talkToUs
              : `/checkout?plan=${encodeURIComponent(plan.code || plan.id)}`;

            return (
              <div
                key={plan.id || plan.code}
                className={cn(
                  adminCardClass('flex flex-col p-5'),
                  isCurrent && 'border-2 border-[#021A54] ring-1 ring-[#021A54]'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-extrabold text-[#101828]">{plan.name}</h2>
                  {isCurrent ? (
                    <span className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-bold text-[#021A54]">
                      Current
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[13px] text-[#667085]">{plan.billing} billing</p>
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
                    : isCurrent
                      ? 'Renew / pay again'
                      : plan.ctaText || 'Select plan'}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
