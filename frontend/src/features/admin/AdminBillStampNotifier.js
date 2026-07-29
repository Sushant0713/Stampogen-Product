'use client';

import { useCallback, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { loyaltyService } from '@/services/loyalty.service';
import { playStampRequestSound } from '@/utils/stampRequestSound';

const POLL_MS = 5000;

function showBillStampToast(stamp) {
  if (!stamp?.id) return;
  const name = stamp.name || 'Customer';
  const offer = stamp.offerTitle || 'Offer';
  const toastId = `bill-stamp-${stamp.id}`;

  toast.dismiss(toastId);
  toast.success(`${name} completed a bill scan for “${offer}”`, {
    id: toastId,
    duration: 5500,
  });
}

/**
 * Polls recent bill scans site-wide for admins and toasts
 * customer name + offer title when a new scan completes.
 */
export function AdminBillStampNotifier({ enabled = true }) {
  const knownIds = useRef(null);

  const poll = useCallback(async () => {
    if (!enabled) return;
    try {
      const { data } = await loyaltyService.adminListRecentBillStamps();
      const stamps = data.data?.stamps || [];
      const ids = new Set(stamps.map((s) => s.id));

      if (knownIds.current == null) {
        knownIds.current = ids;
        return;
      }

      const fresh = stamps.filter((s) => !knownIds.current.has(s.id));
      if (fresh.length > 0) {
        playStampRequestSound();
      }
      // Newest first; cap concurrent toasts
      fresh
        .slice()
        .sort((a, b) => new Date(b.stampedAt) - new Date(a.stampedAt))
        .slice(0, 3)
        .forEach((stamp) => showBillStampToast(stamp));

      knownIds.current = new Set([...knownIds.current, ...ids]);
      // Keep set from growing forever
      if (knownIds.current.size > 200) {
        knownIds.current = ids;
      }
    } catch {
      // Silent — do not spam admin UI
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [enabled, poll]);

  return null;
}
