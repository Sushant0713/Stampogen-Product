'use client';

import dynamic from 'next/dynamic';
import { ContentLoader } from '@/components/loaders/Spinner';

const SuperAdminQrReportsPage = dynamic(
  () =>
    import('@/features/super-admin/SuperAdminQrReportsPage').then(
      (module) => module.SuperAdminQrReportsPage
    ),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function SuperAdminQrReportsRoutePage() {
  return <SuperAdminQrReportsPage />;
}
