'use client';

import dynamic from 'next/dynamic';
import { ContentLoader } from '@/components/loaders/Spinner';

const AdminOutletsDashboard = dynamic(
  () =>
    import('@/features/admin/AdminOutletsDashboard').then((m) => m.AdminOutletsDashboard),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function AdminOutletsDashboardPage() {
  return <AdminOutletsDashboard />;
}
