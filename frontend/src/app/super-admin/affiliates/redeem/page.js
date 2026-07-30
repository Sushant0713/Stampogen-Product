'use client';

import dynamic from 'next/dynamic';
import { ContentLoader } from '@/components/loaders/Spinner';

const AffiliateRedeemList = dynamic(
  () =>
    import('@/features/super-admin/AffiliateRedeemList').then((m) => m.AffiliateRedeemList),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function SuperAdminAffiliateRedeemPage() {
  return <AffiliateRedeemList />;
}
