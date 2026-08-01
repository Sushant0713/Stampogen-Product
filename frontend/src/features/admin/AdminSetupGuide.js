'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, Gift, Printer, Settings2, Trophy, X } from 'lucide-react';
import { loyaltyService } from '@/services/loyalty.service';
import { loyaltyStampModeLabel } from '@/features/admin/LoyaltyStampModeSelector';

const STORAGE_PREFIX = 'stampogen:admin-setup:v1:';

function storageKey(tenantId) {
  return `${STORAGE_PREFIX}${tenantId || 'default'}`;
}

function readProgress(tenantId) {
  if (typeof window === 'undefined') {
    return { dismissed: false, qrShared: false, stampReviewed: false, rewardsSeen: false };
  }
  try {
    const raw = window.localStorage.getItem(storageKey(tenantId));
    if (!raw) {
      return { dismissed: false, qrShared: false, stampReviewed: false, rewardsSeen: false };
    }
    const parsed = JSON.parse(raw);
    return {
      dismissed: Boolean(parsed.dismissed),
      qrShared: Boolean(parsed.qrShared),
      stampReviewed: Boolean(parsed.stampReviewed),
      rewardsSeen: Boolean(parsed.rewardsSeen),
    };
  } catch {
    return { dismissed: false, qrShared: false, stampReviewed: false, rewardsSeen: false };
  }
}

function writeProgress(tenantId, patch) {
  if (typeof window === 'undefined') return;
  const next = { ...readProgress(tenantId), ...patch };
  window.localStorage.setItem(storageKey(tenantId), JSON.stringify(next));
  return next;
}

export function markAdminSetupQrShared(tenantId) {
  return writeProgress(tenantId, { qrShared: true });
}

export function AdminSetupGuide({
  tenantId,
  shopName = 'your shop',
  stampMode = 'bill',
  hasCustomers = false,
  refreshKey = 0,
  onPrintQr,
  onPreviewQr,
}) {
  const [progress, setProgress] = useState(() => readProgress(tenantId));
  const [offerCount, setOfferCount] = useState(null);
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setProgress(readProgress(tenantId));
  }, [tenantId, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingOffers(true);
        const { data } = await loyaltyService.adminListOffers();
        if (!cancelled) {
          const offers = data?.data?.offers || data?.data?.items || [];
          setOfferCount(Array.isArray(offers) ? offers.length : 0);
        }
      } catch {
        if (!cancelled) setOfferCount(0);
      } finally {
        if (!cancelled) setLoadingOffers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateProgress = useCallback(
    (patch) => {
      const next = writeProgress(tenantId, patch);
      if (next) setProgress(next);
    },
    [tenantId]
  );

  const hasOffer = Number(offerCount) > 0;
  const steps = useMemo(
    () => [
      {
        id: 'qr',
        title: 'Print your Loyalty QR',
        description: 'Put it at the counter so customers can join your shop.',
        done: progress.qrShared,
        icon: Printer,
        accent: '#3B82F6',
      },
      {
        id: 'offer',
        title: 'Create your first offer',
        description: 'Set stamps needed and the reward customers unlock.',
        done: hasOffer,
        icon: Gift,
        accent: '#F59E0B',
        href: '/admin/offers',
      },
      {
        id: 'stamp',
        title: 'Confirm how stamps work',
        description: `Currently: ${loyaltyStampModeLabel(stampMode)}. Change anytime in Profile.`,
        done: progress.stampReviewed,
        icon: Settings2,
        accent: '#0EA5E9',
        href: '/admin/profile',
      },
      {
        id: 'rewards',
        title: 'Know where Rewards live',
        description: 'Approve stamp requests and redeem rewards as customers earn them.',
        done: progress.rewardsSeen,
        icon: Trophy,
        accent: '#10B981',
        href: '/admin/rewards',
      },
    ],
    [hasOffer, progress.qrShared, progress.rewardsSeen, progress.stampReviewed, stampMode]
  );

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;
  const setupMature = hasCustomers && hasOffer;

  useEffect(() => {
    if (progress.dismissed || allDone || setupMature) {
      setVisible(false);
    } else {
      setVisible(true);
    }
  }, [allDone, progress.dismissed, setupMature]);

  if (!visible || loadingOffers) return null;

  const percent = Math.round((doneCount / steps.length) * 100);

  const handleDismiss = () => {
    updateProgress({ dismissed: true });
    setVisible(false);
  };

  const handleQrAction = async (action) => {
    updateProgress({ qrShared: true });
    if (typeof action === 'function') await action();
  };

  const handleStepOpen = (step) => {
    if (step.id === 'stamp') updateProgress({ stampReviewed: true });
    if (step.id === 'rewards') updateProgress({ rewardsSeen: true });
  };

  return (
    <section
      className="relative overflow-hidden rounded-[22px] border border-[#D9E4F5] bg-white shadow-[0_14px_36px_rgba(2,26,84,0.08)]"
      aria-label="Shop setup guide"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[120px]"
        style={{
          background:
            'linear-gradient(135deg, rgba(2,26,84,0.06) 0%, rgba(59,130,246,0.08) 45%, rgba(245,158,11,0.06) 100%)',
        }}
      />

      <div className="relative p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#3B82F6]">
              Get started
            </p>
            <h2 className="mt-1 text-[18px] font-extrabold tracking-tight text-[#021A54] sm:text-[20px]">
              Set up {shopName}
            </h2>
            <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-[#64748B]">
              A few quick steps so customers can join, collect stamps, and unlock rewards.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#E2E8F0] bg-white text-[#94A3B8] transition hover:border-[#CBD5E1] hover:text-[#64748B]"
            aria-label="Dismiss setup guide"
            title="I'll explore myself"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold">
            <span className="text-[#64748B]">
              {doneCount} of {steps.length} complete
            </span>
            <span className="text-[#021A54]">{percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#E8EEF7]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#021A54] via-[#2563EB] to-[#3B82F6] transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <ul className="mt-4 space-y-2.5">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const content = (
              <>
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ${
                    step.done ? 'bg-[#ECFDF3] text-[#039855]' : 'text-white'
                  }`}
                  style={step.done ? undefined : { backgroundColor: step.accent }}
                >
                  {step.done ? <Check size={18} strokeWidth={2.6} /> : <Icon size={17} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span
                      className={`text-[13px] font-bold ${
                        step.done ? 'text-[#667085] line-through decoration-[#D0D5DD]' : 'text-[#021A54]'
                      }`}
                    >
                      {index + 1}. {step.title}
                    </span>
                    {step.done ? (
                      <span className="rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[10px] font-bold text-[#039855]">
                        Done
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-[#667085]">
                    {step.description}
                  </span>
                  {step.id === 'qr' && !step.done ? (
                    <span className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleQrAction(onPrintQr)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#021A54] px-3 text-[11px] font-bold text-white"
                      >
                        <Printer size={12} />
                        Print QR
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQrAction(onPreviewQr)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 text-[11px] font-bold text-[#021A54]"
                      >
                        Preview
                      </button>
                    </span>
                  ) : null}
                </span>
                {step.href && !step.done ? (
                  <ChevronRight size={16} className="mt-1 shrink-0 text-[#CBD5E1]" />
                ) : null}
              </>
            );

            const rowClass = `flex w-full items-start gap-3 rounded-[16px] border px-3 py-3 text-left transition ${
              step.done
                ? 'border-[#E7F8EF] bg-[#F7FDF9]'
                : 'border-[#E8EEF7] bg-[#FCFDFE] hover:border-[#C7D7F0] hover:bg-white'
            }`;

            if (step.href) {
              return (
                <li key={step.id}>
                  <Link
                    href={step.href}
                    onClick={() => handleStepOpen(step)}
                    className={rowClass}
                  >
                    {content}
                  </Link>
                </li>
              );
            }

            return (
              <li key={step.id} className={rowClass}>
                {content}
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#EEF2F7] pt-3">
          <p className="text-[11px] font-medium text-[#98A2B3]">
            Takes about 2 minutes. You can skip and come back later.
          </p>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-[12px] font-bold text-[#64748B] underline-offset-2 hover:text-[#021A54] hover:underline"
          >
            I&apos;ll explore myself
          </button>
        </div>
      </div>
    </section>
  );
}
