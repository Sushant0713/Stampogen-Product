'use client';

import Link from 'next/link';
import { CalendarDays, CreditCard, Package, Sparkles, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { MARKETING_LINKS } from '@/constants/marketing';
import { AdminPageHeader } from '@/features/admin/AdminPageShell';
import { ADMIN_ACCENT, adminCardClass } from '@/features/admin/adminTheme';

function formatMoney(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function AdminMyPlan() {
  const { user } = useAuth();
  const sub = user?.subscription || user?.tenant?.subscription || null;
  const pending = sub?.pendingPlan || null;

  if (!sub?.planName) {
    return (
      <div className="mx-auto w-full max-w-3xl lg:max-w-none">
        <AdminPageHeader title="My plan" subtitle="Your Stampogen subscription." />
        <div className={adminCardClass('mx-auto max-w-lg p-8 text-center')}>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF2FF] text-[#021A54]">
            <Package size={26} />
          </div>
          <h2 className="mt-4 text-xl font-extrabold text-[#101828]">No active plan</h2>
          <p className="mt-2 text-sm text-[#667085]">
            You don&apos;t have a subscription yet. Browse plans to get started.
          </p>
          <Link
            href="/admin/plans/browse"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-bold text-white"
            style={{ backgroundColor: ADMIN_ACCENT }}
          >
            Browse plans
          </Link>
        </div>
      </div>
    );
  }

  const days = sub.daysRemaining;
  const daysLabel =
    days == null
      ? '—'
      : days < 0
        ? `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`
        : days === 0
          ? 'Expires today'
          : `${days} day${days === 1 ? '' : 's'} remaining`;

  const tone =
    sub.status === 'expired'
      ? 'border-red-200 bg-red-50 text-red-800'
      : sub.status === 'expiring_soon'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-emerald-200 bg-emerald-50 text-emerald-800';

  return (
    <div className="mx-auto w-full max-w-3xl lg:max-w-none">
      <AdminPageHeader
        title="My plan"
        subtitle={`Subscription for ${user?.tenant?.name || 'your shop'}.`}
      />

      <div className={adminCardClass('p-6 sm:p-8')}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[#021A54]">
              <Sparkles size={18} />
              <span className="text-[12px] font-bold uppercase tracking-[0.06em]">
                Current plan
              </span>
            </div>
            <h2 className="mt-2 text-3xl font-extrabold text-[#101828]">{sub.planName}</h2>
            <p className="mt-1 text-sm text-[#667085]">
              {sub.billing || 'Monthly'} billing · {formatMoney(sub.pricePerCycle)} / cycle
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${tone}`}>
            {daysLabel}
          </span>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { icon: CalendarDays, label: 'Started', value: formatDate(sub.startedAt) },
            { icon: CalendarDays, label: 'Renews / ends', value: formatDate(sub.endsAt) },
            { icon: CreditCard, label: 'Price', value: formatMoney(sub.pricePerCycle) },
          ].map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="rounded-xl border border-[#F2F4F7] bg-[#F8FAFC] px-4 py-3"
            >
              <div className="flex items-center gap-2 text-[#667085]">
                <Icon size={15} />
                <span className="text-[12px] font-bold uppercase">{label}</span>
              </div>
              <p className="mt-1.5 text-sm font-semibold text-[#101828]">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/admin/plans/browse"
            className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-bold text-white"
            style={{ backgroundColor: ADMIN_ACCENT }}
          >
            {sub.status === 'expired' ? 'Renew / change plan' : 'Browse other plans'}
          </Link>
          <Link
            href={MARKETING_LINKS.pricing}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[#D0D5DD] px-5 text-sm font-semibold text-[#344054]"
          >
            View public pricing
          </Link>
        </div>
      </div>

      {pending ? (
        <div className={adminCardClass('mt-5 p-6 sm:p-8')}>
          <div className="inline-flex items-center gap-2 text-[#021A54]">
            <Clock size={18} />
            <span className="text-[12px] font-bold uppercase tracking-[0.06em]">
              Scheduled next
            </span>
          </div>
          <h2 className="mt-2 text-2xl font-extrabold text-[#101828]">{pending.planName}</h2>
          <p className="mt-1 text-sm text-[#667085]">
            Starts when your current plan ends on {formatDate(pending.startsAt)}. Runs until{' '}
            {formatDate(pending.endsAt)}.
          </p>
          <p className="mt-3 text-sm font-medium text-[#344054]">
            {pending.billing || 'Monthly'} · {formatMoney(pending.pricePerCycle)} / cycle
          </p>
        </div>
      ) : null}
    </div>
  );
}
