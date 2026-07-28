'use client';

import dynamic from 'next/dynamic';
import { ContentLoader } from '@/components/loaders/Spinner';

const ClientManagement = dynamic(
  () =>
    import('@/features/super-admin/ClientManagement').then((m) => m.ClientManagement),
  { loading: () => <ContentLoader />, ssr: false }
);

export default function SuperAdminClientsPage() {
  return <ClientManagement />;
}
