'use client';

import dynamic from 'next/dynamic';
import { ContentLoader } from '@/components/loaders/Spinner';

const SuperAdminDashboard = dynamic(
  () =>
    import('@/features/super-admin/SuperAdminDashboard').then(
      (module) => module.SuperAdminDashboard
    ),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function SuperAdminDashboardPage() {
  return <SuperAdminDashboard />;
}
