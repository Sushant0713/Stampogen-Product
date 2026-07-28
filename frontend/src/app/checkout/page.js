import { Suspense } from 'react';
import { CheckoutPage } from '@/features/marketing/CheckoutPage';

export const metadata = {
  title: 'Checkout | Stampogen',
  description: 'Pay for your Stampogen plan and apply a discount code.',
};

export default function CheckoutRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F7F3EB] text-sm text-[#667085]">
          Loading checkout...
        </div>
      }
    >
      <CheckoutPage />
    </Suspense>
  );
}
