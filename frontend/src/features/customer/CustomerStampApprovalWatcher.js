'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { notificationService } from '@/services/notification.service';

const POLL_MS = 12000;
const HANDLED_KEY = 'stampogen.customer.stampApprovedHandled';

function readHandledIds() {
  try {
    const raw = sessionStorage.getItem(HANDLED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function rememberHandledId(id) {
  try {
    const next = [...new Set([...readHandledIds(), String(id)])].slice(-40);
    sessionStorage.setItem(HANDLED_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

/**
 * When the shopkeeper approves a stamp request, open the card celebration
 * if the customer is already using the app.
 */
export function CustomerStampApprovalWatcher({ enabled = false }) {
  const router = useRouter();
  const pathname = usePathname() || '';
  const busyRef = useRef(false);

  const checkApprovals = useCallback(async () => {
    if (!enabled || busyRef.current) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

    busyRef.current = true;
    try {
      const { data } = await notificationService.list({ page: 1, limit: 8 });
      const items = data?.data?.notifications || [];
      const handled = new Set(readHandledIds());
      const hit = items.find(
        (item) =>
          item?.type === 'stamp_approved' &&
          !item.readAt &&
          item.link &&
          !handled.has(String(item._id))
      );
      if (!hit) return;

      rememberHandledId(hit._id);
      try {
        await notificationService.markRead(hit._id);
      } catch {
        // Still navigate — celebration is more important than read state
      }

      const target = String(hit.link);
      // Avoid stacking navigations if already celebrating the same card URL
      if (`${pathname}${typeof window !== 'undefined' ? window.location.search : ''}` === target) {
        return;
      }
      router.push(target);
    } catch {
      // Silent poll
    } finally {
      busyRef.current = false;
    }
  }, [enabled, pathname, router]);

  useEffect(() => {
    if (!enabled) return undefined;
    checkApprovals();
    const timer = window.setInterval(checkApprovals, POLL_MS);
    const onFocus = () => checkApprovals();
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkApprovals();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, checkApprovals]);

  return null;
}
