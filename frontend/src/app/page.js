import { Suspense } from 'react';
import { AdminAuthShell } from '@/components/layout/AdminAuthShell';
import { PortalLoginForm } from '@/features/auth/PortalLoginForm';
import { PageLoader } from '@/components/loaders/Spinner';
import { ROLES } from '@/constants';

export const metadata = {
  title: 'Admin Login | Stampogen',
};

export default function HomePage() {
  return (
    <AdminAuthShell role={ROLES.ADMIN}>
      <Suspense fallback={<PageLoader />}>
        <PortalLoginForm role={ROLES.ADMIN} />
      </Suspense>
    </AdminAuthShell>
  );
}
