import { CustomerCardDetail } from '@/features/customer/CustomerCardDetail';

export const metadata = {
  title: 'Loyalty Card | Stampogen',
};

export default async function CustomerCardPage({ params }) {
  const { slug } = await params;
  return <CustomerCardDetail slug={slug} />;
}
