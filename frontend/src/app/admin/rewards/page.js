'use client';

import dynamic from 'next/dynamic';
import { ContentLoader } from '@/components/loaders/Spinner';

const AdminRewards = dynamic(
  () => import('@/features/admin/AdminRewards').then((m) => m.AdminRewards),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function AdminRewardsPage() {
  return <AdminRewards />;
}
