'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { CheckCircle2, FileSignature, Loader2 } from 'lucide-react';
import { VerificationDocumentField } from '@/components/forms/VerificationDocumentField';
import { AuthButton } from '@/components/forms/AuthNativeFields';
import { affiliateOnboardingService } from '@/services/affiliateOnboarding.service';
import { getErrorMessage } from '@/utils';

export function UploadSignedAgreementForm() {
  const searchParams = useSearchParams();
  const token = useMemo(() => String(searchParams.get('token') || '').trim(), [searchParams]);

  const [metaLoading, setMetaLoading] = useState(true);
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState('');
  const [document, setDocument] = useState('');
  const [documentName, setDocumentName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!token) {
        setMetaError('This upload link is missing a token. Use the link from your email.');
        setMetaLoading(false);
        return;
      }

      try {
        setMetaLoading(true);
        setMetaError('');
        const res = await affiliateOnboardingService.getUploadMeta(token);
        if (cancelled) return;
        setMeta(res.data?.data || null);
      } catch (error) {
        if (cancelled) return;
        setMeta(null);
        setMetaError(getErrorMessage(error, 'Invalid or expired upload link'));
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!document) {
      toast.error('Please upload a photo or PDF of your signed agreement');
      return;
    }

    try {
      setSubmitting(true);
      await affiliateOnboardingService.uploadSignedAgreement({
        token,
        document,
        documentName,
      });
      setDone(true);
      toast.success('Signed agreement uploaded');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to upload document'));
    } finally {
      setSubmitting(false);
    }
  };

  if (metaLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-[#667085]">
        <Loader2 className="h-8 w-8 animate-spin text-[#021A54]" />
        <p className="text-sm">Checking your upload link…</p>
      </div>
    );
  }

    if (metaError) {
    return (
      <div className="rounded-[12px] border border-red-200 bg-red-50 px-4 py-5 text-center">
        <p className="text-[15px] font-semibold text-red-700">Link cancelled or unavailable</p>
        <p className="mt-2 text-[14px] text-red-600">{metaError}</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-[12px] border border-emerald-200 bg-emerald-50 px-4 py-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <p className="mt-3 text-[17px] font-semibold text-emerald-800">Document received</p>
        <p className="mt-2 text-[14px] text-emerald-700">
          Thanks{meta?.firstName ? `, ${meta.firstName}` : ''}. Your signed agreement was uploaded.
          This upload link is now cancelled and cannot be used again.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-[12px] border border-[#E4E7EC] bg-[#F9FAFB] px-4 py-3 text-[14px] text-[#344054]">
        Sign the Affiliate Partner Agreement we emailed you, then upload a clear photo or PDF of the
        signed copy. This link can be used once and expires{' '}
        {meta?.expiresAt
          ? new Date(meta.expiresAt).toLocaleString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            })
          : 'soon'}
        .
      </div>

      <VerificationDocumentField
        label="Signed agreement (photo or PDF)"
        value={document}
        fileName={documentName}
        required
        hint="JPG, PNG, WEBP, or PDF · max 5MB"
        onChange={({ verificationDocument, verificationDocumentName }) => {
          setDocument(verificationDocument || '');
          setDocumentName(verificationDocumentName || '');
        }}
      />

      <AuthButton
        type="submit"
        disabled={submitting}
        className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[10px] bg-[#021A54] text-[17px] font-semibold text-white transition hover:bg-[#01133F] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading…
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <FileSignature size={16} />
            Submit signed agreement
          </span>
        )}
      </AuthButton>
    </form>
  );
}
