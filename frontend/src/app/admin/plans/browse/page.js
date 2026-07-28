'use client';

import dynamic from 'next/dynamic';
import { ContentLoader } from '@/components/loaders/Spinner';

const AdminBrowsePlans = dynamic(
  () => import('@/features/admin/AdminBrowsePlans').then((m) => m.AdminBrowsePlans),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function AdminBrowsePlansPage() {
  return <AdminBrowsePlans />;
}
