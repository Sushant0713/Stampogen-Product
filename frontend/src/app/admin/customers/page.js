'use client';

import dynamic from 'next/dynamic';
import { ContentLoader } from '@/components/loaders/Spinner';

const AdminCustomers = dynamic(
  () => import('@/features/admin/AdminCustomers').then((m) => m.AdminCustomers),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function AdminCustomersPage() {
  return <AdminCustomers />;
}
