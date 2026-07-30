'use client';

import { useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';
import {
  installStampSoundUnlock,
  isStampRequestSoundUnlocked,
  subscribeStampSoundUnlock,
  unlockStampRequestSound,
} from '@/utils/stampRequestSound';

/**
 * Unlocks notification audio after the first tap (mobile Chrome autoplay policy)
 * and shows a compact banner until sound is enabled.
 */
export function AdminSoundUnlock({ enabled = true }) {
  const [needsUnlock, setNeedsUnlock] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;

    setNeedsUnlock(!isStampRequestSoundUnlocked());
    const uninstall = installStampSoundUnlock();
    const unsub = subscribeStampSoundUnlock(() => setNeedsUnlock(false));

    return () => {
      uninstall?.();
      unsub?.();
    };
  }, [enabled]);

  if (!enabled || !needsUnlock) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[72px] z-[80] flex justify-center px-3 lg:bottom-6">
      <button
        type="button"
        onClick={() => {
          void unlockStampRequestSound().then((ok) => {
            if (ok) setNeedsUnlock(false);
          });
        }}
        className="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 text-left shadow-[0_14px_32px_rgba(2,26,84,0.18)] active:scale-[0.98]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#021A54] text-white">
          <Volume2 size={16} />
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-extrabold text-[#021A54]">
            Enable notification sound
          </span>
          <span className="block text-[11px] font-medium text-[#64748B]">
            Tap once so stamp alerts can play on this phone
          </span>
        </span>
      </button>
    </div>
  );
}
