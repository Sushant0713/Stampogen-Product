'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { loyaltyService } from '@/services/loyalty.service';
import { getErrorMessage } from '@/utils';
import { CustomerScanFlow } from '@/features/customer/CustomerScanFlow';

export function CustomerRequestStampFlow({ slug }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const offerTitle = searchParams.get('offer') || 'Stamp';
  const offerKey = searchParams.get('offerKey') || '';
  const [card, setCard] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await loyaltyService.getCard(slug);
      setCard(data.data.card);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Card not found'));
      router.push('/app');
    }
  }, [router, slug]);

  useEffect(() => {
    load();
  }, [load]);

  const requestStamp = async () => {
    try {
      setBusy(true);
      const { data } = await loyaltyService.requestStamp(slug, {
        offerKey: offerKey || undefined,
        offerTitle,
      });
      toast.success(data.message || 'Stamp request sent');
      router.push(`/app/cards/${slug}`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to request stamp'));
    } finally {
      setBusy(false);
    }
  };

  if (!card) {
    return <p className="text-sm text-[#64748B]">Loading…</p>;
  }

  const offer = (card.offers || []).find((o) => o.key === offerKey) || card.offers?.[0];

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link
          href={`/app/cards/${slug}/offers`}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(2,26,84,0.08)]"
          aria-label="Back"
        >
          <svg width="9" height="15" viewBox="0 0 9 15" fill="none" aria-hidden>
            <path
              d="M8 1L1 7.5L8 14"
              stroke="#021A54"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-extrabold text-[#021A54]">Request stamp</h1>
          <p className="text-[12.5px] font-medium text-[#64748B]">{offerTitle}</p>
        </div>
      </div>

      <div className="rounded-[24px] bg-gradient-to-br from-[#021A54] to-[#3B82F6] p-6 text-white shadow-[0_16px_40px_rgba(2,26,84,0.2)]">
        <p className="text-sm font-semibold text-white/90">{card.name}</p>
        <p className="mt-2 text-2xl font-extrabold">{offerTitle}</p>
        <p className="mt-3 text-sm text-white/80">
          Tap below after your visit. The shop will approve or reject your stamp request.
        </p>
        {offer ? (
          <p className="mt-4 inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
            Current progress: {offer.progressText || `${offer.stamps} of ${offer.stampsRequired} stamps`}
          </p>
        ) : null}
      </div>

      <div className="rounded-[20px] bg-white p-4 shadow-[0_8px_20px_rgba(2,26,84,0.06)]">
        <p className="text-sm font-bold text-[#0F172A]">What happens next?</p>
        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-[#64748B]">
          <li>1. You send a stamp request from here</li>
          <li>2. Shop owner sees your name and offer</li>
          <li>3. They tap Approve or Reject</li>
          <li>4. You get +1 stamp when approved</li>
        </ul>
      </div>

      <button
        type="button"
        disabled={busy || offer?.stampRequestPending}
        onClick={requestStamp}
        className="rounded-2xl bg-[#021A54] py-4 text-sm font-bold text-white hover:bg-[#0B2C6E] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy
          ? 'Sending…'
          : offer?.stampRequestPending
            ? 'Waiting for shop approval'
            : 'Request stamp from shop'}
      </button>
    </div>
  );
}

export function CustomerStampFlow({ slug }) {
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loyaltyService
      .getCard(slug)
      .then(({ data }) => {
        if (!cancelled) setCard(data.data.card);
      })
      .catch(() => {
        if (!cancelled) setCard(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return <p className="text-sm text-[#64748B]">Loading…</p>;
  }

  if (card?.stampMode === 'request') {
    return <CustomerRequestStampFlow slug={slug} />;
  }

  return <CustomerScanFlow slug={slug} />;
}
