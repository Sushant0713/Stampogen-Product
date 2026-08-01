'use client';

import dynamic from 'next/dynamic';
import { ContentLoader } from '@/components/loaders/Spinner';

const SuperAdminQrPage = dynamic(
  () => import('@/features/super-admin/SuperAdminQrPage').then((m) => m.SuperAdminQrPage),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function SuperAdminSettingsQrPage() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#667085]">
          Settings
        </p>
        <h1 className="mt-1 font-display text-[28px] font-semibold tracking-tight text-[#101828]">
          QR codes
        </h1>
        <p className="mt-1 text-sm text-[#667085]">
          Generate QR codes from website links and keep a reusable list.
        </p>
      </div>
      <SuperAdminQrPage />
    </div>
  );
}
