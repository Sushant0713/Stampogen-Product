import { Suspense } from 'react';
import { CustomerStampFlow } from '@/features/customer/CustomerStampFlow';
import { PageLoader } from '@/components/loaders/Spinner';

export const metadata = {
  title: 'Collect Stamp | Stampogen',
};

export default async function CustomerScanPage({ params }) {
  const { slug } = await params;
  return (
    <Suspense fallback={<PageLoader />}>
      <CustomerStampFlow slug={slug} />
    </Suspense>
  );
}
