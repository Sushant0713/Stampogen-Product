'use client';

import dynamic from 'next/dynamic';
import { ContentLoader } from '@/components/loaders/Spinner';

const PlanList = dynamic(
  () => import('@/features/super-admin/PlanList').then((m) => m.PlanList),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function SuperAdminPlansPage() {
  return <PlanList />;
}
