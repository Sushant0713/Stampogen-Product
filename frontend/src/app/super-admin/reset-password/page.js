import { Suspense } from 'react';
import { AdminAuthShell } from '@/components/layout/AdminAuthShell';
import { ResetPasswordForm } from '@/features/auth/ResetPasswordForm';
import { PageLoader } from '@/components/loaders/Spinner';
import { ROLES } from '@/constants';

export const metadata = {
  title: 'Reset Password | Stampogen',
};

export default function SuperAdminResetPasswordPage() {
  return (
    <AdminAuthShell role={ROLES.SUPER_ADMIN}>
      <Suspense fallback={<PageLoader />}>
        <ResetPasswordForm role={ROLES.SUPER_ADMIN} />
      </Suspense>
    </AdminAuthShell>
  );
}
