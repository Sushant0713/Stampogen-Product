import { Suspense } from 'react';
import { AdminAuthShell } from '@/components/layout/AdminAuthShell';
import { PortalRegisterForm } from '@/features/auth/PortalRegisterForm';
import { PageLoader } from '@/components/loaders/Spinner';
import { ROLES } from '@/constants';

export const metadata = {
  title: 'Admin Register | Stampogen',
};

export default function AdminRegisterPage() {
  return (
    <AdminAuthShell role={ROLES.ADMIN}>
      <Suspense fallback={<PageLoader />}>
        <PortalRegisterForm role={ROLES.ADMIN} />
      </Suspense>
    </AdminAuthShell>
  );
}
