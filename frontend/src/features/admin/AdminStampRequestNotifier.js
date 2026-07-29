'use client';

import { useCallback, useEffect, useRef } from 'react';
import { loyaltyService } from '@/services/loyalty.service';
import { showStampRequestToast } from '@/features/admin/StampRequestToast';
import { playStampRequestSound } from '@/utils/stampRequestSound';

const POLL_MS = 5000;

/**
 * Polls pending stamp requests site-wide for admins and shows
 * top toasts with Approve / Reject when new ones arrive.
 */
export function AdminStampRequestNotifier({ enabled = true }) {
  const knownIds = useRef(null);

  const poll = useCallback(async () => {
    if (!enabled) return;
    try {
      const { data } = await loyaltyService.adminListStampRequests();
      const requests = data.data?.requests || [];
      const ids = new Set(requests.map((r) => r.id));

      if (knownIds.current == null) {
        knownIds.current = ids;
        return;
      }

      const fresh = requests.filter((r) => !knownIds.current.has(r.id));
      if (fresh.length > 0) {
        playStampRequestSound();
      }
      // Newest first; show up to 3 toasts at once
      fresh.slice(0, 3).forEach((req) => showStampRequestToast(req));

      knownIds.current = ids;
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

  useEffect(() => {
    if (!enabled) return undefined;
    const onResolved = (event) => {
      const id = event.detail?.id;
      if (id && knownIds.current) {
        knownIds.current.delete(id);
      }
    };
    window.addEventListener('stampogen:stamp-request-resolved', onResolved);
    return () => window.removeEventListener('stampogen:stamp-request-resolved', onResolved);
  }, [enabled]);

  return null;
}
