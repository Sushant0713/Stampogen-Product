'use client';

import Link from 'next/link';
import { ADMIN_ACCENT, adminCardClass } from '@/features/admin/adminTheme';

export function AdminPageHeader({ title, subtitle, actionHref, actionLabel }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold text-[#021A54] lg:text-[28px]">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-[13px] font-medium text-[#64748B]">{subtitle}</p>
        ) : null}
      </div>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-bold text-white"
          style={{ backgroundColor: ADMIN_ACCENT }}
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function AdminComingSoon({ title, description, emoji = '🚀' }) {
  return (
    <div className={adminCardClass('mx-auto max-w-lg p-8 text-center')}>
      <div className="text-4xl" aria-hidden>
        {emoji}
      </div>
      <h2 className="mt-4 text-xl font-extrabold text-[#021A54]">{title}</h2>
      <p className="mt-2 text-sm text-[#64748B]">{description}</p>
    </div>
  );
}
