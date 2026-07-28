'use client';

import dynamic from 'next/dynamic';
import { ContentLoader } from '@/components/loaders/Spinner';

const AdminMyPlan = dynamic(
  () => import('@/features/admin/AdminMyPlan').then((m) => m.AdminMyPlan),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function AdminMyPlanPage() {
  return <AdminMyPlan />;
}
