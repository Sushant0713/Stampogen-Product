import { Suspense } from 'react';
import { CustomerJoinPage } from '@/features/customer/CustomerJoinPage';
import { PageLoader } from '@/components/loaders/Spinner';

export const metadata = {
  title: 'Join Shop | Stampogen',
};

export default async function JoinShopPage({ params }) {
  const { slug } = await params;
  return (
    <Suspense fallback={<PageLoader />}>
      <CustomerJoinPage slug={slug} />
    </Suspense>
  );
}
