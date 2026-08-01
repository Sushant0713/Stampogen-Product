'use client';

import dynamic from 'next/dynamic';
import { ContentLoader } from '@/components/loaders/Spinner';

const SuperAdminQrPage = dynamic(
  () => import('@/features/super-admin/SuperAdminQrPage').then((m) => m.SuperAdminQrPage),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function SuperAdminSettingsQrPage() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#667085]">
            Tools
          </p>
          <h1 className="mt-1 font-display text-[28px] font-semibold tracking-tight text-[#101828]">
            QR codes
          </h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-[#667085]">
            Turn any website link into a print-ready QR. Build a reusable library for posters,
            flyers, and campaigns.
          </p>
        </div>
      </div>
      <SuperAdminQrPage />
    </div>
  );
}
