'use client';

import { cn } from '@/utils';

export const LOYALTY_STAMP_MODE_OPTIONS = [
  {
    value: 'bill',
    title: 'Bill scanner',
    description: 'Customers photograph their bill to earn stamps. You verify bills when rewards are ready.',
    emoji: '🧾',
  },
  {
    value: 'request',
    title: 'Stamp requests',
    description: 'Customers request a stamp after visiting. You approve or reject each request — no bill needed.',
    emoji: '✅',
  },
];

export function loyaltyStampModeLabel(mode) {
  return (
    LOYALTY_STAMP_MODE_OPTIONS.find((o) => o.value === mode)?.title || 'Bill scanner'
  );
}

export function LoyaltyStampModeSelector({ value, onChange, name = 'loyaltyStampMode', disabled = false }) {
  return (
    <div className="space-y-2">
      <p className="text-[16px] font-semibold text-[#101828]">
        How do customers earn stamps? <span className="text-red-500">*</span>
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {LOYALTY_STAMP_MODE_OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                'cursor-pointer rounded-[12px] border p-3.5 transition',
                selected
                  ? 'border-[#021A54] bg-[#F5F8FF] ring-1 ring-[#021A54]'
                  : 'border-[#EAECF0] bg-white hover:border-[#CBD5E1]',
                disabled && 'pointer-events-none opacity-60'
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <div className="flex items-start gap-2.5">
                <span className="text-xl">{option.emoji}</span>
                <div>
                  <p className="text-sm font-bold text-[#021A54]">{option.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[#64748B]">{option.description}</p>
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
