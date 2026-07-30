'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { FeaturedCard, LoyaltyCardListItem } from '@/features/customer/LoyaltyCard';
import { CustomerSoundSettings } from '@/features/customer/CustomerSoundSettings';
import { customerCardClass } from '@/features/customer/customerTheme';
import { loyaltyService } from '@/services/loyalty.service';
import { getErrorMessage } from '@/utils';

export function CustomerHome() {
  const router = useRouter();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await loyaltyService.listCards();
      setCards(data.data.cards || []);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to load loyalty cards'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const featured = cards[0] || null;
  const rest = cards.slice(1);

  const stats = useMemo(
    () => [
      { label: 'Active cards', value: String(cards.length) },
      {
        label: 'Stamps collected',
        value: String(cards.reduce((sum, c) => sum + (c.stamps || 0), 0)),
      },
      {
        label: 'Rewards ready',
        value: String(cards.filter((c) => c.isRedeemable).length),
      },
    ],
    [cards]
  );

  const openCard = (slug) => router.push(`/app/cards/${slug}`);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm font-semibold text-[#64748B]">
        Loading your cards…
      </div>
    );
  }

  if (!cards.length) {
    return (
      <div className={customerCardClass('mx-auto max-w-lg p-8 text-center')}>
        <p className="text-xl font-extrabold text-[#021A54]">No loyalty cards yet</p>
        <p className="mt-2 text-sm leading-relaxed text-[#64748B]">
          Scan a shop&apos;s QR code at checkout to join their loyalty program. Your cards will
          appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-7">
      <div className="flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#021A54] sm:text-[26px] lg:text-3xl">
            My Loyalty Cards
          </h1>
          <p className="mt-1.5 max-w-xl text-[12px] leading-relaxed text-[#64748B] sm:mt-2 sm:text-[13px]">
            Collect stamps, unlock rewards, and discover new offers from your favorite shops.
          </p>
        </div>
        <div className="hidden gap-3 lg:flex">
          {stats.map((s) => (
            <div key={s.label} className={customerCardClass('min-w-[120px] px-4 py-3')}>
              <p className="text-lg font-extrabold text-[#021A54]">{s.value}</p>
              <p className="text-[11px] font-semibold text-[#94A3B8]">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile stats strip */}
      <div className="grid grid-cols-3 gap-2 lg:hidden">
        {stats.map((s) => (
          <div key={s.label} className={customerCardClass('px-2.5 py-2.5 text-center')}>
            <p className="text-base font-extrabold text-[#021A54]">{s.value}</p>
            <p className="mt-0.5 text-[10px] font-semibold leading-tight text-[#94A3B8]">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <CustomerSoundSettings className="lg:hidden" />

      <div className="grid gap-4 lg:grid-cols-5 lg:items-start lg:gap-6">
        <div className="lg:col-span-3">
          {featured ? (
            <FeaturedCard
              card={featured}
              onOpen={() => openCard(featured.slug)}
            />
          ) : null}
        </div>
        <div className="hidden flex-col gap-3 lg:col-span-2 lg:flex">
          {stats.map((s) => (
            <div key={s.label} className={customerCardClass('px-5 py-4')}>
              <p className="text-2xl font-extrabold text-[#021A54]">{s.value}</p>
              <p className="text-xs font-semibold text-[#94A3B8]">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {rest.length > 0 ? (
        <div>
          <h2 className="mb-3 text-sm font-bold tracking-tight text-[#021A54] sm:mb-3.5 sm:text-base">
            Active Loyalty Cards
          </h2>
          <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
            {rest.map((card) => (
              <LoyaltyCardListItem
                key={card.id}
                card={card}
                onOpen={() => openCard(card.slug)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
