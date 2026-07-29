'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { PremiumLoyaltyCard } from '@/features/customer/LoyaltyCard';
import { PartyPopper } from '@/features/customer/PartyPopper';
import { ShopSocialLinks } from '@/features/shared/ShopSocialLinks';
import { customerCardClass, relativeTime } from '@/features/customer/customerTheme';
import { loyaltyService } from '@/services/loyalty.service';
import { getErrorMessage } from '@/utils';

export function CustomerCardDetail({ slug }) {
  const router = useRouter();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await loyaltyService.getCard(slug);
      setCard(data.data.card);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Card not found'));
      router.push('/app');
    } finally {
      setLoading(false);
    }
  }, [router, slug]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRedeem = async () => {
    try {
      setBusy(true);
      const { data } = await loyaltyService.redeem(slug);
      setCard(data.data.card);
      toast.success(data.message || 'Sent to the shop for verification');
      setCelebrate(true);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to redeem'));
    } finally {
      setBusy(false);
    }
  };

  const status = card?.rewardStatus || 'collecting';
  const statusBanner =
    status === 'pending'
      ? {
          className: 'bg-[#EFF6FF] text-[#1D4ED8]',
          title: 'Waiting for shop verification',
          body: 'All stamps are collected. The shopkeeper will review your bill photos and give the reward.',
        }
      : status === 'verified'
        ? {
            className: 'bg-[#ECFDF5] text-[#047857]',
            title: 'Bills verified — collect at shop',
            body: 'Show this card at the counter. The shop can give your reward now.',
          }
        : status === 'redeemed'
          ? {
              className: 'bg-[#F1F5F9] text-[#475569]',
              title: 'Reward already given',
              body: 'Start earning stamps again on your next visits.',
            }
          : null;

  if (loading || !card) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm font-semibold text-[#64748B]">
        Loading card…
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 lg:max-w-none lg:grid lg:grid-cols-[280px_1fr] lg:items-start lg:gap-8">
      <PartyPopper active={celebrate} intensity="big" onDone={() => setCelebrate(false)} />
      <div className="lg:sticky lg:top-24">
        <button
          type="button"
          onClick={() => router.push('/app')}
          className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(2,26,84,0.08)] lg:hidden"
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
        </button>
        <Link
          href="/app"
          className="mb-4 hidden text-sm font-semibold text-[#3B82F6] hover:underline lg:inline-flex"
        >
          ← All cards
        </Link>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Shop</p>
        <h1 className="text-2xl font-extrabold text-[#021A54]">{card.name}</h1>
      </div>

      <div className="flex flex-col gap-5">
        <PremiumLoyaltyCard card={card} />

        <ShopSocialLinks
          links={card.socialLinks}
          className={customerCardClass('p-4')}
        />

        {statusBanner ? (
          <div className={`rounded-2xl px-4 py-3.5 text-[13px] ${statusBanner.className}`}>
            <p className="font-bold">{statusBanner.title}</p>
            <p className="mt-1 leading-relaxed opacity-90">{statusBanner.body}</p>
          </div>
        ) : null}

        {card.isRedeemable && status === 'collecting' ? (
          <button
            type="button"
            disabled={busy}
            onClick={handleRedeem}
            className="flex items-center justify-center gap-2 rounded-2xl bg-[#10B981] py-4 text-sm font-bold text-white hover:bg-[#059669] disabled:opacity-60"
          >
            ⭐ Send to shop for reward
          </button>
        ) : card.isRedeemable && (status === 'pending' || status === 'verified') ? null : !card.isRedeemable ? (
          <Link
            href={`/app/cards/${slug}/offers`}
            className="flex items-center justify-center gap-2 rounded-2xl bg-[#021A54] py-4 text-sm font-bold text-white hover:bg-[#0B2C6E]"
          >
            Earn Stamp — View Offers
          </Link>
        ) : null}

        <div className={customerCardClass('p-5')}>
          <p className="text-sm font-bold text-[#021A54]">How it works</p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-[#64748B]">
            Photograph your bill for each stamp. When you complete the card, the shop verifies your
            bills and gives the reward at the counter.
          </p>
        </div>

        {card.lastStampAt ? (
          <div className={customerCardClass('px-4 py-3')}>
            <div className="flex gap-3">
              <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#EFF6FF]">
                ✓
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#0F172A]">Last stamp collected</p>
                <p className="text-[11.5px] text-[#94A3B8]">{relativeTime(card.lastStampAt)}</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
