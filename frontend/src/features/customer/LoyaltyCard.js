'use client';

import { StampRowLarge, StampRowSmall } from '@/features/customer/StampDots';

export function FeaturedCard({ card, onOpen }) {
  if (!card) return null;
  const dots = Array.from({ length: card.stampsRequired }, (_, i) => ({
    filled: i < card.stamps,
    empty: i >= card.stamps,
  }));

  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative w-full overflow-hidden rounded-[24px] bg-gradient-to-br from-[#021A54] via-[#0B2C6E] to-[#1E4FA3] p-6 text-left shadow-[0_20px_36px_-14px_rgba(2,26,84,0.5)] transition hover:shadow-[0_24px_44px_-10px_rgba(2,26,84,0.65)] lg:p-8"
    >
      <div className="pointer-events-none absolute -right-[70px] -top-[70px] h-[220px] w-[220px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.16),transparent_70%)]" />
      <div className="pointer-events-none absolute -bottom-[90px] -left-[50px] h-[220px] w-[220px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.3),transparent_70%)]" />
      <div className="relative z-[1]">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#0B2C6E] to-[#3B82F6] text-[15px] font-bold text-white shadow-[0_4px_10px_rgba(0,0,0,0.25)]">
            {card.initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[16.5px] font-bold text-white">{card.name}</div>
            <div className="mt-0.5 text-[12.5px] text-white/55">{card.campaign}</div>
          </div>
        </div>
        <div className="mb-5 text-[19px] font-bold tracking-tight text-white">{card.reward}</div>
        <StampRowLarge dots={dots} />
        <div className="mt-[18px] flex items-center justify-between gap-3">
          <div className="text-[12.5px] font-medium text-white/70">{card.progressText}</div>
          <div className="shrink-0 rounded-[100px] border border-white/20 bg-white/14 px-3 py-1.5 text-[12.5px] font-semibold text-white backdrop-blur-sm">
            {card.badgeLabel}
          </div>
        </div>
      </div>
    </button>
  );
}

export function LoyaltyCardListItem({ card, onOpen }) {
  const dots = Array.from({ length: card.stampsRequired }, (_, i) => ({
    filled: i < card.stamps,
    empty: i >= card.stamps,
  }));

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-[20px] bg-white p-4 text-left shadow-[0_8px_20px_rgba(2,26,84,0.06),0_1px_3px_rgba(2,26,84,0.04)] transition hover:shadow-[0_12px_26px_rgba(2,26,84,0.1)]"
    >
      <div className="mb-3.5 flex items-center gap-3">
        <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#021A54] to-[#3B82F6] text-[13px] font-bold text-white">
          {card.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-bold text-[#0F172A]">{card.name}</div>
          <div className="mt-0.5 text-xs text-[#94A3B8]">{card.campaign}</div>
        </div>
        <div className="shrink-0 rounded-xl bg-[#F1F5F9] px-2.5 py-1.5 text-xs font-semibold text-[#021A54]">
          {card.reward}
        </div>
      </div>
      <StampRowSmall dots={dots} />
      <div className="mt-2 text-[11.5px] font-medium text-[#94A3B8]">{card.progressText}</div>
    </button>
  );
}
