'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import { ContentLoader } from '@/components/loaders/Spinner';

const PlatformTrialSettings = dynamic(
  () =>
    import('@/features/super-admin/PlatformTrialSettings').then((m) => m.PlatformTrialSettings),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function SuperAdminFreeTrialSettingsPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#667085]">
            Settings
          </p>
          <h1 className="mt-1 font-display text-[28px] font-semibold tracking-tight text-[#101828]">
            Free trial
          </h1>
          <p className="mt-1 text-sm text-[#667085]">
            Choose the default trial plan and length for public signup and Super Admin grants.
          </p>
        </div>
        <Link
          href="/super-admin/settings/trial/reports"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E4E7EC] bg-white px-4 text-sm font-semibold text-[#344054] transition hover:border-[#021A54]/25"
        >
          <BarChart3 size={15} />
          Trial reports
        </Link>
      </div>
      <PlatformTrialSettings />
    </div>
  );
}
