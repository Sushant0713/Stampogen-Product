import { Suspense } from 'react';
import { AdminAuthShell } from '@/components/layout/AdminAuthShell';
import { ForgotPasswordForm } from '@/features/auth/ForgotPasswordForm';
import { PageLoader } from '@/components/loaders/Spinner';
import { ROLES } from '@/constants';

export const metadata = {
  title: 'Forgot Password | Stampogen',
};

export default function AdminForgotPasswordPage() {
  return (
    <AdminAuthShell role={ROLES.ADMIN}>
      <Suspense fallback={<PageLoader />}>
        <ForgotPasswordForm role={ROLES.ADMIN} />
      </Suspense>
    </AdminAuthShell>
  );
}
