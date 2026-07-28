'use client';

import dynamic from 'next/dynamic';
import { ContentLoader } from '@/components/loaders/Spinner';

const InvoiceSettings = dynamic(
  () => import('@/features/super-admin/InvoiceSettings').then((m) => m.InvoiceSettings),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function SuperAdminInvoiceSettingsPage() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#667085]">
          Settings
        </p>
        <h1 className="mt-1 font-display text-[28px] font-semibold tracking-tight text-[#101828]">
          Invoice setting
        </h1>
        <p className="mt-1 text-sm text-[#667085]">
          Configure the platform invoice template and billing defaults.
        </p>
      </div>
      <InvoiceSettings />
    </div>
  );
}
