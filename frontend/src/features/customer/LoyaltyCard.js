'use client';

import { StampProgressTrack } from '@/features/customer/StampDots';

function GiftIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8M12 22V7M2 7h20v5H2V7ZM12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7ZM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7Z"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const cardShellStyle = {
  background: 'linear-gradient(135deg, #020B24 0%, #021A54 48%, #0A3A8C 100%)',
  boxShadow: '0 14px 28px -12px rgba(2, 26, 84, 0.5)',
};

const glowTopStyle = {
  background: 'radial-gradient(ellipse at 80% 20%, rgba(59,130,246,0.25), transparent 55%)',
};

function CardBody({ card, isDense }) {
  const stamps = card.stamps || 0;
  const required = card.stampsRequired || 5;
  const remaining = Math.max(0, required - stamps);

  const rewardHint =
    remaining === 0
      ? card.isRedeemable
        ? 'Ready to redeem'
        : 'All stamps collected'
      : `${remaining} more to unlock`;

  return (
    <>
      <div className="pointer-events-none absolute inset-0" style={glowTopStyle} />
      <div className={`relative z-10 flex flex-col ${isDense ? 'gap-2.5' : 'gap-3'}`}>
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)' }}
          >
            {card.initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-bold leading-tight text-white sm:text-sm">
              {card.name}
            </div>
            <div className="truncate text-[11px] text-sky-300/90">
              {card.campaign || 'Loyalty Club'}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-sm font-extrabold leading-none text-white">
              {stamps}/{required}
            </div>
            <div className="mt-0.5 text-[9px] text-white/50">stamps</div>
          </div>
        </div>

        <div className="rounded-xl bg-white px-2.5 py-2">
          <StampProgressTrack stamps={stamps} stampsRequired={required} size="sm" />
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-white/15 bg-white/5 p-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600">
            <GiftIcon size={13} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[10px] text-white/65">{rewardHint}</div>
            <div className="truncate text-[12px] font-extrabold uppercase tracking-wide text-sky-400">
              {card.reward || 'Reward'}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function PremiumLoyaltyCard({ card, onOpen, density = 'default' }) {
  if (!card) return null;

  const isDense = density === 'dense';
  const shellClass = `relative w-full max-w-md overflow-hidden rounded-2xl text-left ${
    isDense ? 'p-3.5' : 'p-3.5 sm:p-4'
  }`;

  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        style={cardShellStyle}
        className={`${shellClass} transition active:scale-[0.98]`}
      >
        <CardBody card={card} isDense={isDense} />
      </button>
    );
  }

  return (
    <div style={cardShellStyle} className={shellClass}>
      <CardBody card={card} isDense={isDense} />
    </div>
  );
}

export function FeaturedCard({ card, onOpen }) {
  return <PremiumLoyaltyCard card={card} onOpen={onOpen} density="default" />;
}

export function LoyaltyCardListItem({ card, onOpen }) {
  return <PremiumLoyaltyCard card={card} onOpen={onOpen} density="dense" />;
}
