'use client';

import dynamic from 'next/dynamic';
import { ContentLoader } from '@/components/loaders/Spinner';

const SuperAdminReports = dynamic(
  () =>
    import('@/features/super-admin/SuperAdminReports').then((module) => module.SuperAdminReports),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function SuperAdminReportsPage() {
  return <SuperAdminReports />;
}
