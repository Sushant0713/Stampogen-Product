'use client';

import dynamic from 'next/dynamic';
import { ContentLoader } from '@/components/loaders/Spinner';

const AdminProfile = dynamic(
  () => import('@/features/admin/AdminProfile').then((m) => m.AdminProfile),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function AdminProfilePage() {
  return <AdminProfile />;
}
