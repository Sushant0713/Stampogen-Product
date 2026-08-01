'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
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
            Turn any website link into a trackable, print-ready QR. Scan counts appear in QR Reports.
          </p>
        </div>
        <Link
          href="/super-admin/settings/qr/reports"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E4E7EC] bg-white px-4 text-sm font-semibold text-[#344054] transition hover:border-[#021A54]/25"
        >
          <BarChart3 size={15} />
          QR Reports
        </Link>
      </div>
      <SuperAdminQrPage />
    </div>
  );
}
