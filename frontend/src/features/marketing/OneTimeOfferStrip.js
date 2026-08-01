'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronDown, Copy, Tag, Ticket } from 'lucide-react';

const COLORS = {
  ink: '#141414',
  muted: '#5C5C5C',
  navy: '#1A334D',
  red: '#B43D2E',
};

function copyCode(code) {
  if (!code || typeof navigator === 'undefined' || !navigator.clipboard) {
    toast.error('Unable to copy code');
    return;
  }
  navigator.clipboard
    .writeText(code)
    .then(() => toast.success(`Copied ${code}`))
    .catch(() => toast.error('Unable to copy code'));
}

function discountCopyLabel(offer) {
  if (offer?.amountType === 'flat') {
    const amount = Number(offer.amountValue || 0).toLocaleString('en-IN');
    return `Copy code for ₹${amount} discount`;
  }
  const pct = Number(offer?.amountValue || 0);
  if (pct > 0) return `Copy code for ${pct}% discount`;
  if (offer?.offerLabel) {
    return `Copy code for ${String(offer.offerLabel).replace(/\s*off$/i, '')} discount`;
  }
  return 'Copy code';
}

/**
 * Collapsible one-time coupon list. Closed by default.
 * @param {object} props
 * @param {Array} props.offers
 * @param {string} [props.className]
 * @param {(code: string) => void} [props.onUseCode] — if set, also fills/uses code on click
 * @param {string} [props.closedHint]
 * @param {string} [props.openHint]
 * @param {'default'|'compact'} [props.variant] — compact = thin checkout row (copy only)
 */
export function OneTimeOfferStrip({
  offers,
  className = 'mt-10',
  onUseCode,
  closedHint,
  openHint = 'Apply the code below at checkout on your first payment.',
  variant = 'default',
}) {
  const [open, setOpen] = useState(false);

  if (!offers?.length) return null;

  const handleCopy = (code) => {
    copyCode(code);
    if (typeof onUseCode === 'function') {
      onUseCode(code);
    }
  };

  if (variant === 'compact') {
    return (
      <div
        className={`overflow-hidden rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] ${className}`}
      >
        <ul className="divide-y divide-[#EAECF0]">
          {offers.map((offer) => (
            <li key={offer.id}>
              <button
                type="button"
                onClick={() => handleCopy(offer.code)}
                className="flex h-9 w-full items-center justify-between gap-2 px-3 text-left transition hover:bg-white"
              >
                <span className="truncate text-[12px] font-medium text-[#344054]">
                  {discountCopyLabel(offer)}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-[#021A54]">
                  <Copy size={12} />
                  Copy
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <section
      className={`overflow-hidden rounded-2xl border border-[#E5D8C8] bg-gradient-to-br from-[#FFF8F0] via-[#F7F5EE] to-[#EEF3FF] ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-white/30 sm:px-6"
      >
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ backgroundColor: COLORS.red }}
          >
            <Ticket size={18} />
          </span>
          <div className="min-w-0">
            <p
              className="text-[11px] font-bold uppercase tracking-[0.14em]"
              style={{ color: COLORS.red }}
            >
              One-time launch offer
            </p>
            <h2
              className="mt-1 font-[family-name:var(--font-outfit)] text-[20px] font-bold tracking-tight sm:text-[22px]"
              style={{ color: COLORS.ink }}
            >
              Limited coupons for first-time shops
            </h2>
            <p className="mt-1 text-[13px]" style={{ color: COLORS.muted }}>
              {open
                ? openHint
                : closedHint ||
                  `${offers.length} coupon${offers.length > 1 ? 's' : ''} available — tap to view`}
            </p>
          </div>
        </div>
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5D8C8] bg-white text-[#1A334D] transition"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <ChevronDown size={18} />
        </span>
      </button>

      {open ? (
        <div className="border-t border-[#E5D8C8]/80 px-5 pb-5 pt-4 sm:px-6">
          <p className="mb-4 max-w-xl text-[14px] leading-relaxed" style={{ color: COLORS.muted }}>
            {openHint} Codes disappear when the use limit is reached.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {offers.map((offer) => (
              <li
                key={offer.id}
                className="flex flex-col gap-3 rounded-xl border border-[#E8DFD2] bg-white/80 px-4 py-3.5 backdrop-blur"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-bold" style={{ color: COLORS.ink }}>
                      {offer.name}
                    </p>
                    <p className="mt-0.5 text-[13px] font-semibold" style={{ color: COLORS.red }}>
                      {offer.offerLabel}
                      {offer.specificPlan && offer.specificPlan !== 'Any plan'
                        ? ` · ${offer.specificPlan}`
                        : ' · All plans'}
                    </p>
                    {offer.description ? (
                      <p className="mt-1 text-[12px] leading-snug" style={{ color: COLORS.muted }}>
                        {offer.description}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
                    style={{ backgroundColor: COLORS.navy }}
                  >
                    <Tag size={11} />
                    {offer.offerLabel}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <code
                    className="rounded-lg border border-dashed px-3 py-1.5 text-[13px] font-bold tracking-[0.06em]"
                    style={{
                      borderColor: COLORS.navy,
                      color: COLORS.navy,
                      backgroundColor: '#F3F6FB',
                    }}
                  >
                    {offer.code}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopy(offer.code)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] font-bold text-white transition hover:opacity-90"
                    style={{ backgroundColor: COLORS.navy }}
                  >
                    <Copy size={13} />
                    {onUseCode ? 'Use code' : 'Copy code'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
