import { Suspense } from 'react';
import { FileSignature } from 'lucide-react';
import { AdminAuthShell } from '@/components/layout/AdminAuthShell';
import { UploadSignedAgreementForm } from '@/features/auth/UploadSignedAgreementForm';
import { PageLoader } from '@/components/loaders/Spinner';
import { ROLES } from '@/constants';

export const metadata = {
  title: 'Upload signed agreement | Stampogen',
};

function UploadContent() {
  return (
    <div className="w-full">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-5 flex h-[64px] w-[64px] items-center justify-center rounded-full bg-[#EAF2FF] text-[#021A54]">
          <FileSignature size={32} strokeWidth={1.75} />
        </div>
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-[#021A54]">
          Upload signed agreement
        </h1>
        <p className="mt-2.5 text-[14px] leading-relaxed text-[#667085]">
          Complete onboarding by uploading your signed Affiliate Partner Agreement.
        </p>
      </div>
      <UploadSignedAgreementForm />
    </div>
  );
}

export default function AffiliateUploadAgreementPage() {
  return (
    <AdminAuthShell role={ROLES.AFFILIATE}>
      <Suspense fallback={<PageLoader />}>
        <UploadContent />
      </Suspense>
    </AdminAuthShell>
  );
}
