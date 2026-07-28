import { Suspense } from 'react';
import { CustomerOffers } from '@/features/customer/CustomerOffers';
import { PageLoader } from '@/components/loaders/Spinner';

export const metadata = {
  title: 'Offers | Stampogen',
};

export default async function CustomerOffersPage({ params }) {
  const { slug } = await params;
  return (
    <Suspense fallback={<PageLoader />}>
      <CustomerOffers slug={slug} />
    </Suspense>
  );
}
