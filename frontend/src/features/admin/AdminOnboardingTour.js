'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';

const STORAGE_PREFIX = 'stampogen:admin-tour:v1:';

const TOUR_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to your shop dashboard',
    body: 'A quick tour of where everything lives — skip anytime if you already know the app.',
    selector: null,
    placement: 'center',
  },
  {
    id: 'qr',
    title: 'Your Loyalty QR',
    body: 'Print or preview this QR and place it at checkout. Customers scan it to join your loyalty program.',
    selector: '[data-tour="admin-qr"]',
    placement: 'bottom',
    requirePath: '/admin/dashboard',
  },
  {
    id: 'home',
    title: 'Home',
    body: 'Your daily overview — customers, pending rewards, and QR scan activity live here.',
    selector: '[data-tour="admin-home"]',
    placement: 'auto',
  },
  {
    id: 'offers',
    title: 'Offers',
    body: 'Create and manage loyalty cards here — stamps required, reward title, and active campaigns.',
    selector: '[data-tour="admin-offers"]',
    placement: 'auto',
  },
  {
    id: 'rewards',
    title: 'Rewards',
    body: 'Approve stamp requests and redeem rewards when customers finish collecting stamps.',
    selector: '[data-tour="admin-rewards"]',
    placement: 'auto',
  },
  {
    id: 'customers',
    title: 'Customers',
    body: 'See everyone who joined your shop and how their stamp progress looks.',
    selector: '[data-tour="admin-customers"]',
    placement: 'auto',
  },
  {
    id: 'profile',
    title: 'Profile',
    body: 'Edit your shop profile, billing details, and how customers earn stamps (bill scan or stamp requests).',
    selector: '[data-tour="admin-profile"]',
    placement: 'auto',
  },
];

function storageKey(userId) {
  return `${STORAGE_PREFIX}${userId || 'default'}`;
}

function hasCompletedTour(userId) {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(storageKey(userId)) === '1';
  } catch {
    return true;
  }
}

function markTourCompleted(userId) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(userId), '1');
  } catch {
    // ignore
  }
}

function pickVisibleTarget(selector) {
  if (!selector || typeof document === 'undefined') return null;
  const nodes = Array.from(document.querySelectorAll(selector));
  return (
    nodes.find((el) => {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }) || null
  );
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function AdminOnboardingTour({ enabled = true }) {
  const router = useRouter();
  const pathname = usePathname() || '';
  const { user } = useUser();
  const userId = user?._id || user?.id || '';

  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);

  const steps = TOUR_STEPS;
  const step = steps[stepIndex] || null;

  const finish = useCallback(() => {
    markTourCompleted(userId);
    setActive(false);
    setTargetRect(null);
  }, [userId]);

  const measure = useCallback(() => {
    if (!step) {
      setTargetRect(null);
      return;
    }
    if (!step.selector) {
      setTargetRect(null);
      return;
    }
    const el = pickVisibleTarget(step.selector);
    if (!el) {
      setTargetRect(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    setTargetRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      bottom: rect.bottom,
      right: rect.right,
    });
    try {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    } catch {
      // ignore
    }
  }, [step]);

  useEffect(() => {
    if (!enabled || !userId) return undefined;
    if (hasCompletedTour(userId)) return undefined;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const onHome = pathname === '/admin/dashboard' || pathname === '/admin/home';
      if (!onHome) {
        router.replace('/admin/dashboard');
      }
      setStepIndex(0);
      setActive(true);
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Start once when admin becomes available and tour not completed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, userId]);

  useEffect(() => {
    if (!active) return undefined;
    const t = window.setTimeout(measure, 300);
    return () => window.clearTimeout(t);
  }, [active, pathname, measure]);

  useLayoutEffect(() => {
    if (!active) return undefined;
    measure();
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [active, measure, stepIndex, pathname]);

  useEffect(() => {
    if (!active || !step?.selector) return undefined;
    if (targetRect) return undefined;
    const id = window.setInterval(measure, 200);
    const stop = window.setTimeout(() => window.clearInterval(id), 2000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(stop);
    };
  }, [active, step, targetRect, measure]);

  const goNext = () => {
    if (stepIndex >= steps.length - 1) {
      finish();
      return;
    }
    const next = steps[stepIndex + 1];
    if (next?.requirePath && pathname !== next.requirePath) {
      router.push(next.requirePath);
    }
    setStepIndex((i) => i + 1);
  };

  const goBack = () => {
    if (stepIndex <= 0) return;
    const prev = steps[stepIndex - 1];
    if (prev?.requirePath && pathname !== prev.requirePath) {
      router.push(prev.requirePath);
    }
    setStepIndex((i) => Math.max(0, i - 1));
  };

  const tooltipStyle = useMemo(() => {
    const pad = 12;
    const tipWidth = Math.min(340, typeof window !== 'undefined' ? window.innerWidth - 24 : 340);

    if (!targetRect) {
      return {
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: tipWidth,
      };
    }

    const spaceBelow = (typeof window !== 'undefined' ? window.innerHeight : 800) - targetRect.bottom;
    const placeBelow = spaceBelow > 180 || targetRect.top < 160;
    const left = clamp(
      targetRect.left + targetRect.width / 2 - tipWidth / 2,
      12,
      (typeof window !== 'undefined' ? window.innerWidth : 400) - tipWidth - 12
    );

    if (placeBelow) {
      return {
        position: 'fixed',
        left,
        top: targetRect.bottom + pad,
        width: tipWidth,
      };
    }

    return {
      position: 'fixed',
      left,
      bottom: (typeof window !== 'undefined' ? window.innerHeight : 800) - targetRect.top + pad,
      width: tipWidth,
    };
  }, [targetRect]);

  if (!active || !step) return null;

  const hole = targetRect
    ? {
        top: Math.max(8, targetRect.top - 8),
        left: Math.max(8, targetRect.left - 8),
        width: targetRect.width + 16,
        height: targetRect.height + 16,
      }
    : null;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Admin product tour">
      {/* Overlay with spotlight hole */}
      <div className="absolute inset-0" aria-hidden>
        {hole ? (
          <div
            className="absolute rounded-2xl ring-2 ring-white/90 transition-all duration-300"
            style={{
              top: hole.top,
              left: hole.left,
              width: hole.width,
              height: hole.height,
              boxShadow: '0 0 0 9999px rgba(2, 26, 84, 0.62)',
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-[rgba(2,26,84,0.62)]" />
        )}
      </div>

      <div
        className="z-[101] overflow-hidden rounded-2xl border border-white/20 bg-white shadow-[0_24px_60px_rgba(2,26,84,0.35)]"
        style={tooltipStyle}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#EEF2F7] bg-gradient-to-r from-[#F8FAFF] to-white px-4 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#3B82F6]">
              Tip {stepIndex + 1} of {steps.length}
            </p>
            <h3 className="mt-0.5 text-[15px] font-extrabold text-[#021A54]">{step.title}</h3>
          </div>
          <button
            type="button"
            onClick={finish}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#64748B]"
            aria-label="Close tour"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-3">
          <p className="text-[13px] leading-relaxed text-[#64748B]">{step.body}</p>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[#EEF2F7] px-4 py-3">
          <button
            type="button"
            onClick={finish}
            className="text-[12px] font-bold text-[#94A3B8] hover:text-[#64748B]"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {stepIndex > 0 ? (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex h-9 items-center rounded-xl border border-[#E2E8F0] bg-white px-3.5 text-[12px] font-bold text-[#021A54]"
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              onClick={goNext}
              className="inline-flex h-9 items-center rounded-xl bg-[#021A54] px-4 text-[12px] font-bold text-white"
            >
              {stepIndex >= steps.length - 1 ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
