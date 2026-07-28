import { Suspense } from 'react';
import { AdminAuthShell } from '@/components/layout/AdminAuthShell';
import { ResetPasswordForm } from '@/features/auth/ResetPasswordForm';
import { PageLoader } from '@/components/loaders/Spinner';
import { ROLES } from '@/constants';

export const metadata = {
  title: 'Reset Password | Stampogen Affiliate',
};

export default function AffiliateResetPasswordPage() {
  return (
    <AdminAuthShell role={ROLES.AFFILIATE}>
      <Suspense fallback={<PageLoader />}>
        <ResetPasswordForm role={ROLES.AFFILIATE} />
      </Suspense>
    </AdminAuthShell>
  );
}
