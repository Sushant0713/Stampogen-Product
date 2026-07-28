'use client';

import dynamic from 'next/dynamic';
import { ContentLoader } from '@/components/loaders/Spinner';

const AdminOffers = dynamic(
  () => import('@/features/admin/AdminOffers').then((m) => m.AdminOffers),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function AdminOffersPage() {
  return <AdminOffers />;
}
