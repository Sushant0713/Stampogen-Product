'use client';

import dynamic from 'next/dynamic';
import { ContentLoader } from '@/components/loaders/Spinner';

const AffiliateSettings = dynamic(
  () =>
    import('@/features/super-admin/AffiliateSettings').then((m) => m.AffiliateSettings),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function SuperAdminAffiliateSettingsPage() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#667085]">
          Affiliate
        </p>
        <h1 className="mt-1 font-display text-[28px] font-semibold tracking-tight text-[#101828]">
          Affiliate Settings
        </h1>
        <p className="mt-1 text-sm text-[#667085]">
          Enable affiliate types, set partner coupon %, affiliate earning %, and redeem
          targets.
        </p>
      </div>
      <AffiliateSettings />
    </div>
  );
}
