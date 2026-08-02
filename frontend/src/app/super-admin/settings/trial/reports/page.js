'use client';

import dynamic from 'next/dynamic';
import { ContentLoader } from '@/components/loaders/Spinner';

const SuperAdminTrialReportsPage = dynamic(
  () =>
    import('@/features/super-admin/SuperAdminTrialReportsPage').then(
      (module) => module.SuperAdminTrialReportsPage
    ),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function SuperAdminTrialReportsRoutePage() {
  return <SuperAdminTrialReportsPage />;
}
