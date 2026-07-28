'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { loyaltyService } from '@/services/loyalty.service';
import { getErrorMessage } from '@/utils';

export function CustomerOffers({ slug }) {
  const router = useRouter();
  const [card, setCard] = useState(null);

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

  if (!card) {
    return <p className="text-sm text-[#64748B]">Loading offers…</p>;
  }

  const isRequestMode = card.stampMode === 'request';
  const actionHint = isRequestMode
    ? 'Request a stamp after each visit — the shop will approve it.'
    : 'Photograph your bill for the offer you want to earn.';

  const offers = (card.offers || []).map((o) => ({
    id: o.key,
    title: o.title,
    requirement: `${o.stamps} of ${o.stampsRequired} stamps`,
    minOrderValue: o.minOrderValue || 0,
    href: `/app/cards/${slug}/scan?offerKey=${encodeURIComponent(o.key)}&offer=${encodeURIComponent(o.title)}`,
    disabled: !o.canEarn,
    status: o.rewardStatus,
    pendingRequest: o.stampRequestPending,
  }));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link
          href={`/app/cards/${slug}`}
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
        <h1 className="text-xl font-extrabold text-[#021A54]">{card.name} Offers</h1>
      </div>
      <p className="-mt-2 text-[13px] text-[#64748B]">{actionHint}</p>

      <div className="flex flex-col gap-3">
        {offers.map((o) =>
          o.disabled ? (
            <div
              key={o.id}
              className="flex items-center justify-between gap-3 rounded-[20px] bg-gradient-to-br from-[#021A54] to-[#3B82F6] p-[18px] text-white opacity-75 shadow-[0_8px_20px_rgba(2,26,84,0.12)]"
            >
              <div>
                <p className="text-[14.5px] font-bold">{o.title}</p>
                <span className="mt-1.5 inline-block rounded-[100px] bg-white/22 px-2.5 py-1 text-[11px] font-semibold">
                  {o.requirement}
                  {o.minOrderValue > 0 ? ` · Min ₹${o.minOrderValue}` : ''}
                  {o.pendingRequest ? ' · Waiting for shop' : ''}
                  {o.status === 'pending' ? ' · Reward pending' : ''}
                  {o.status === 'verified' ? ' · Verified' : ''}
                  {o.status === 'redeemed' ? ' · Redeemed' : ''}
                </span>
              </div>
            </div>
          ) : (
            <Link
              key={o.id}
              href={o.href}
              className="flex items-center justify-between gap-3 rounded-[20px] bg-gradient-to-br from-[#021A54] to-[#3B82F6] p-[18px] text-white shadow-[0_8px_20px_rgba(2,26,84,0.12)] transition hover:shadow-[0_12px_26px_rgba(2,26,84,0.2)]"
            >
              <div>
                <p className="text-[14.5px] font-bold">{o.title}</p>
                <span className="mt-1.5 inline-block rounded-[100px] bg-white/22 px-2.5 py-1 text-[11px] font-semibold">
                  {o.requirement}
                  {o.minOrderValue > 0 ? ` · Min ₹${o.minOrderValue}` : ''}
                </span>
              </div>
              <span className="text-[11px] font-bold text-white/80">
                {isRequestMode ? 'Request ›' : 'Scan ›'}
              </span>
            </Link>
          )
        )}
      </div>
    </div>
  );
}
