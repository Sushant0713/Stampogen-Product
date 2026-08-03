'use client';

import dynamic from 'next/dynamic';
import { ContentLoader } from '@/components/loaders/Spinner';

const AdminOutletsPage = dynamic(
  () => import('@/features/admin/AdminOutletsPage').then((m) => m.AdminOutletsPage),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function AdminOutletsRoutePage() {
  return <AdminOutletsPage />;
}
