import { Suspense } from 'react';
import { AdminAuthShell } from '@/components/layout/AdminAuthShell';
import { PortalLoginForm } from '@/features/auth/PortalLoginForm';
import { PageLoader } from '@/components/loaders/Spinner';
import { ROLES } from '@/constants';

export const metadata = {
  title: 'Super Admin Login | Stampogen',
};

export default function SuperAdminLoginPage() {
  return (
    <AdminAuthShell role={ROLES.SUPER_ADMIN}>
      <Suspense fallback={<PageLoader />}>
        <PortalLoginForm role={ROLES.SUPER_ADMIN} />
      </Suspense>
    </AdminAuthShell>
  );
}
