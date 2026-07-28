import { Suspense } from 'react';
import { ShieldCheck } from 'lucide-react';
import { AdminAuthShell } from '@/components/layout/AdminAuthShell';
import { VerifyEmailForm } from '@/features/auth/VerifyEmailForm';
import { PageLoader } from '@/components/loaders/Spinner';
import { ROLES } from '@/constants';

export const metadata = {
  title: 'Verify Email | Stampogen',
};

function VerifyContent({ role }) {
  return (
    <div className="w-full">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-5 flex h-[64px] w-[64px] items-center justify-center rounded-full bg-[#EAF2FF] text-[#021A54]">
          <ShieldCheck size={32} strokeWidth={1.75} />
        </div>
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-[#021A54]">
          Verify your email
        </h1>
        <p className="mt-2.5 text-[14px] leading-relaxed text-[#667085]">
          Enter the 6-digit OTP we sent to continue securely.
        </p>
      </div>
      <VerifyEmailForm role={role} />
    </div>
  );
}

export default function SuperAdminVerifyEmailPage() {
  return (
    <AdminAuthShell role={ROLES.SUPER_ADMIN}>
      <Suspense fallback={<PageLoader />}>
        <VerifyContent role={ROLES.SUPER_ADMIN} />
      </Suspense>
    </AdminAuthShell>
  );
}
