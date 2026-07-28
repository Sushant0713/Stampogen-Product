'use client';

import dynamic from 'next/dynamic';
import { ContentLoader } from '@/components/loaders/Spinner';

const DiscountList = dynamic(
  () => import('@/features/super-admin/DiscountList').then((m) => m.DiscountList),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function SuperAdminDiscountsPage() {
  return <DiscountList />;
}
