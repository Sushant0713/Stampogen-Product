'use client';

import dynamic from 'next/dynamic';
import { ContentLoader } from '@/components/loaders/Spinner';

const AdminHome = dynamic(
  () => import('@/features/admin/AdminHome').then((m) => m.AdminHome),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function AdminHomePage() {
  return <AdminHome />;
}
