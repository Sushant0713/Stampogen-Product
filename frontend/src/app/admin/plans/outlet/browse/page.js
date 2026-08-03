'use client';

import dynamic from 'next/dynamic';
import { ContentLoader } from '@/components/loaders/Spinner';

const AdminBrowseOutletPlans = dynamic(
  () =>
    import('@/features/admin/AdminBrowseOutletPlans').then((m) => m.AdminBrowseOutletPlans),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function AdminBrowseOutletPlansPage() {
  return <AdminBrowseOutletPlans />;
}
