import { Suspense } from 'react';
import { AdminAuthShell } from '@/components/layout/AdminAuthShell';
import { ForgotPasswordForm } from '@/features/auth/ForgotPasswordForm';
import { PageLoader } from '@/components/loaders/Spinner';
import { ROLES } from '@/constants';

export const metadata = {
  title: 'Forgot Password | Stampogen Affiliate',
};

export default function AffiliateForgotPasswordPage() {
  return (
    <AdminAuthShell role={ROLES.AFFILIATE}>
      <Suspense fallback={<PageLoader />}>
        <ForgotPasswordForm role={ROLES.AFFILIATE} />
      </Suspense>
    </AdminAuthShell>
  );
}
