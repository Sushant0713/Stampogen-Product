'use client';

import dynamic from 'next/dynamic';
import { ContentLoader } from '@/components/loaders/Spinner';

const SuperAdminRevenue = dynamic(
  () =>
    import('@/features/super-admin/SuperAdminRevenue').then((module) => module.SuperAdminRevenue),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function SuperAdminRevenuePage() {
  return <SuperAdminRevenue />;
}
