'use client';

import dynamic from 'next/dynamic';
import { ContentLoader } from '@/components/loaders/Spinner';

const PlatformInvoiceList = dynamic(
  () =>
    import('@/features/super-admin/PlatformInvoiceList').then((m) => m.PlatformInvoiceList),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function SuperAdminPlatformInvoicePage() {
  return <PlatformInvoiceList />;
}
