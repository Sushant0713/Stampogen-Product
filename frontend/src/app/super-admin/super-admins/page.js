'use client';

import dynamic from 'next/dynamic';
import { ContentLoader } from '@/components/loaders/Spinner';

const SuperAdminList = dynamic(
  () => import('@/features/super-admin/SuperAdminList').then((m) => m.SuperAdminList),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function SuperAdminListPage() {
  return <SuperAdminList />;
}
