'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { affiliateOnboardingService } from '@/services/affiliateOnboarding.service';
import { getErrorMessage } from '@/utils';

const ACCENT = '#021A54';

export function ClaimAffiliateAccessForm() {
  const searchParams = useSearchParams();
  const token = String(searchParams.get('token') || '').trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [details, setDetails] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!token || token.length < 32) {
        setError('This access link is missing or invalid.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const { data } = await affiliateOnboardingService.getCredentialsMeta(token);
        if (cancelled) return;
        setDetails(data?.data || null);
        setError('');
      } catch (err) {
        if (cancelled) return;
        setDetails(null);
        setError(getErrorMessage(err, 'Unable to open this access link'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const copyText = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Unable to copy ${label.toLowerCase()}`);
    }
  };

  if (loading) {
    return (
      <p className="text-center text-sm text-[#667085]">Opening your portal access…</p>
    );
  }

  if (error || !details) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
        {error || 'Unable to load access details.'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-4">
        <p className="text-[13px] font-semibold text-[#101828]">
          Hi {details.name || 'there'}
        </p>
        <p className="mt-1 text-[13px] text-[#667085]">
          Use these details to sign in to the Stampogen affiliate portal.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-medium text-[#667085]">Email</p>
            <p className="text-sm font-semibold text-[#101828] break-all">{details.email}</p>
          </div>
          <button
            type="button"
            onClick={() => copyText(details.email, 'Email')}
            className="shrink-0 rounded-md border border-[#D0D5DD] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#344054]"
          >
            Copy
          </button>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-medium text-[#667085]">Temporary password</p>
            <p className="font-mono text-sm font-semibold text-[#101828]">
              {details.temporaryPassword}
            </p>
          </div>
          <button
            type="button"
            onClick={() => copyText(details.temporaryPassword, 'Password')}
            className="shrink-0 rounded-md border border-[#D0D5DD] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#344054]"
          >
            Copy
          </button>
        </div>
      </div>

      {details.discountCode ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-[13px] font-semibold text-[#021A54]">Affiliate Discount Code</p>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-sm font-semibold text-[#101828]">
                {details.discountCode}
              </p>
              <p className="mt-0.5 text-[12px] text-[#667085]">
                {details.discountPercent || 20}% off all plans
              </p>
            </div>
            <button
              type="button"
              onClick={() => copyText(details.discountCode, 'Discount code')}
              className="shrink-0 rounded-md border border-[#D0D5DD] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#344054]"
            >
              Copy
            </button>
          </div>
        </div>
      ) : null}

      <Link
        href="/affiliate/login"
        className="inline-flex h-11 w-full items-center justify-center rounded-lg text-sm font-semibold text-white"
        style={{ backgroundColor: ACCENT }}
      >
        Go to affiliate login
      </Link>
    </div>
  );
}
