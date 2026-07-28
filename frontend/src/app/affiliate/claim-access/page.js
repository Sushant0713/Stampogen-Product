import { Suspense } from 'react';
import { KeyRound } from 'lucide-react';
import { AdminAuthShell } from '@/components/layout/AdminAuthShell';
import { ClaimAffiliateAccessForm } from '@/features/auth/ClaimAffiliateAccessForm';
import { PageLoader } from '@/components/loaders/Spinner';
import { ROLES } from '@/constants';

export const metadata = {
  title: 'Your portal access | Stampogen',
};

function ClaimContent() {
  return (
    <div className="w-full">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-5 flex h-[64px] w-[64px] items-center justify-center rounded-full bg-[#EAF2FF] text-[#021A54]">
          <KeyRound size={32} strokeWidth={1.75} />
        </div>
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-[#021A54]">
          Your portal access
        </h1>
        <p className="mt-2.5 text-[14px] leading-relaxed text-[#667085]">
          Secure one-time link from your Stampogen approval email.
        </p>
      </div>
      <ClaimAffiliateAccessForm />
    </div>
  );
}

export default function AffiliateClaimAccessPage() {
  return (
    <AdminAuthShell role={ROLES.AFFILIATE}>
      <Suspense fallback={<PageLoader />}>
        <ClaimContent />
      </Suspense>
    </AdminAuthShell>
  );
}
