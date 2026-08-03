'use client';

import Link from 'next/link';
import { Lock, Sparkles, ArrowRight, CalendarDays } from 'lucide-react';
import { ADMIN_ACCENT, adminCardClass } from '@/features/admin/adminTheme';

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Full-page facility lock when free trial or paid plan has ended.
 */
export function AdminUpgradeGate({ lock }) {
  const sub = lock?.subscription || null;
  const isTrial = lock?.reason === 'trial';
  const isNone = lock?.reason === 'none';
  const days = sub?.daysRemaining;
  const endedOn = formatDate(sub?.endsAt || sub?.trialEndsAt);

  const title = isNone
    ? 'Choose a plan to continue'
    : isTrial
      ? 'Your free trial has ended'
      : 'Your plan has ended';

  const detail = isNone
    ? 'Your shop does not have an active subscription. Pick a plan to unlock Stampogen.'
    : isTrial
      ? `Your free trial of ${sub?.planName || 'Stampogen'} has ended${
          endedOn ? ` on ${endedOn}` : ''
        }. Upgrade to keep using stamps, offers, rewards, and customers.`
      : `Your ${sub?.planName || 'Stampogen'} plan has ended${
          endedOn ? ` on ${endedOn}` : ''
        }. Renew or upgrade to unlock your shop tools again.`;

  const agoLabel =
    days != null && days < 0
      ? `Ended ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`
      : endedOn
        ? `Ended ${endedOn}`
        : null;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center px-1 py-6 sm:py-10">
      <div className={adminCardClass('w-full overflow-hidden p-0')}>
        <div
          className="relative px-6 pb-8 pt-10 text-center sm:px-8"
          style={{
            background:
              'linear-gradient(165deg, #EEF2FF 0%, #FFFFFF 48%, #FFF7ED 100%)',
          }}
        >
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-[0_12px_28px_rgba(2,26,84,0.22)]"
            style={{ backgroundColor: ADMIN_ACCENT }}
            aria-hidden
          >
            <Lock size={28} strokeWidth={2.25} />
          </div>

          <span
            className={`mt-5 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-bold ${
              isTrial || isNone
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            <Sparkles size={13} />
            {isNone ? 'No active plan' : isTrial ? 'Free trial ended' : 'Plan ended'}
          </span>

          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-[#101828] sm:text-[28px]">
            {title}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#667085]">{detail}</p>

          {agoLabel ? (
            <p className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#344054]">
              <CalendarDays size={14} className="text-[#98A2B3]" />
              {agoLabel}
            </p>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/admin/plans/browse"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-sm font-bold text-white shadow-[0_10px_22px_rgba(2,26,84,0.2)] transition hover:opacity-95"
              style={{ backgroundColor: ADMIN_ACCENT }}
            >
              Upgrade plan
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/admin/plans/my"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-[#D0D5DD] bg-white px-6 text-sm font-semibold text-[#344054] transition hover:bg-[#F8FAFC]"
            >
              View my plan
            </Link>
          </div>
        </div>

        <div className="border-t border-[#F2F4F7] bg-[#FCFCFD] px-6 py-4 text-center sm:px-8">
          <p className="text-[12px] leading-relaxed text-[#98A2B3]">
            Stamps, offers, rewards, customers, and other shop tools stay locked until you upgrade.
          </p>
        </div>
      </div>
    </div>
  );
}
