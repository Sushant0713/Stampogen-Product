'use client';

import dynamic from 'next/dynamic';
import { ContentLoader } from '@/components/loaders/Spinner';

const AffiliateList = dynamic(
  () => import('@/features/super-admin/AffiliateList').then((m) => m.AffiliateList),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function SuperAdminAffiliatesPage() {
  return <AffiliateList />;
}
