'use client';

import dynamic from 'next/dynamic';
import { ContentLoader } from '@/components/loaders/Spinner';

const PendingAffiliateList = dynamic(
  () =>
    import('@/features/super-admin/PendingAffiliateList').then((m) => m.PendingAffiliateList),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function SuperAdminPendingAffiliatesPage() {
  return <PendingAffiliateList />;
}
