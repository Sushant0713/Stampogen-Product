'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PartyPopper } from '@/features/customer/PartyPopper';
import { PremiumLoyaltyCard } from '@/features/customer/LoyaltyCard';

const COPY = {
  photo: {
    pill: '+1 Stamp collected',
    title: 'Stamp collected!',
  },
  approved: {
    pill: '+1 Stamp approved',
    title: 'Stamp collected!',
  },
  complete: {
    pill: 'Card complete!',
    title: 'All stamps collected!',
  },
};

/**
 * Full-screen celebration after a stamp is earned (bill photo or shop approve).
 * Blurs the page, lifts the loyalty card, and blasts confetti.
 */
export function StampCelebrateOverlay({
  active = false,
  card = null,
  mode = 'photo',
  intensity = 'normal',
  onDone,
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!active || !card) {
      setVisible(false);
      return undefined;
    }

    setVisible(true);
    const ms = intensity === 'big' ? 2800 : 2400;
    const timer = window.setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, ms);

    return () => window.clearTimeout(timer);
  }, [active, card, intensity, onDone]);

  if (!mounted || !visible || !card || typeof document === 'undefined') {
    return null;
  }

  const copy = COPY[mode] || COPY.photo;
  const stamps = card.stamps || 0;
  const required = card.stampsRequired || 5;

  return createPortal(
    <div className="fixed inset-0 z-[190] flex items-start justify-center px-4 pb-8 pt-[12vh] sm:pt-[14vh]">
      <div
        className="absolute inset-0 bg-[#020B24]/55 backdrop-blur-md transition-opacity"
        aria-hidden
      />

      <PartyPopper active intensity={intensity} />

      <div className="relative z-[210] flex w-full max-w-[360px] flex-col items-center gap-4">
        <div
          className="stamp-celebrate-pill inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-extrabold text-[#021A54] shadow-[0_12px_32px_rgba(2,26,84,0.28)]"
          role="status"
        >
          <span aria-hidden className="text-base">
            {mode === 'complete' ? '⭐' : '✓'}
          </span>
          {copy.pill}
        </div>

        <div className="stamp-celebrate-card w-full">
          <PremiumLoyaltyCard card={card} />
        </div>

        <div className="stamp-celebrate-meta text-center">
          <p className="text-lg font-extrabold text-white drop-shadow">{copy.title}</p>
          <p className="mt-1 text-sm font-semibold text-white/85">
            {stamps}/{required} stamps · {card.name}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes stampCelebratePillIn {
          0% { opacity: 0; transform: translateY(-12px) scale(0.92); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes stampCelebrateCardIn {
          0% { opacity: 0; transform: translateY(48px) scale(0.9); }
          55% { opacity: 1; transform: translateY(-10px) scale(1.05); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes stampCelebrateMetaIn {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .stamp-celebrate-pill {
          animation: stampCelebratePillIn 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .stamp-celebrate-card {
          animation: stampCelebrateCardIn 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
          filter: drop-shadow(0 28px 40px rgba(0, 0, 0, 0.35));
        }
        .stamp-celebrate-meta {
          animation: stampCelebrateMetaIn 520ms 180ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
      `}</style>
    </div>,
    document.body
  );
}
