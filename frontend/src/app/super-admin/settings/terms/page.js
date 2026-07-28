'use client';

import dynamic from 'next/dynamic';
import { ContentLoader } from '@/components/loaders/Spinner';

const AgreementSettings = dynamic(
  () => import('@/features/super-admin/AgreementSettings').then((m) => m.AgreementSettings),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function SuperAdminTermsSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[28px] font-semibold tracking-tight text-[#101828]">
          Terms and conditions
        </h1>
        <p className="mt-1 text-sm text-[#667085]">
          Manage Terms and Conditions for Affiliate Partners and Clients.
        </p>
      </div>
      <AgreementSettings />
    </div>
  );
}
