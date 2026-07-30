'use client';

import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import {
  DEFAULT_CUSTOMER_STAMP_SOUND_VOLUME,
  getCustomerStampSoundMuted,
  getCustomerStampSoundVolume,
  playCustomerStampSound,
  setCustomerStampSoundMuted,
  setCustomerStampSoundVolume,
  unlockCustomerStampSound,
} from '@/utils/customerStampSound';
import { cn } from '@/utils';

/**
 * Mute + volume controls for customer stamp celebration sound.
 */
export function CustomerSoundSettings({ className = '', compact = false }) {
  const [volume, setVolume] = useState(DEFAULT_CUSTOMER_STAMP_SOUND_VOLUME);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setVolume(getCustomerStampSoundVolume());
    setMuted(getCustomerStampSoundMuted());
  }, []);

  const handleMuteToggle = () => {
    const next = !muted;
    setMuted(next);
    setCustomerStampSoundMuted(next);
    if (!next) {
      void unlockCustomerStampSound().then(() => playCustomerStampSound());
    }
  };

  const handleVolumeChange = (value) => {
    const next = Number(value) / 100;
    setVolume(next);
    setCustomerStampSoundVolume(next);
    if (next > 0 && muted) {
      setMuted(false);
      setCustomerStampSoundMuted(false);
    }
  };

  const handlePreview = () => {
    void unlockCustomerStampSound().then(() => {
      if (!getCustomerStampSoundMuted()) {
        playCustomerStampSound();
      }
    });
  };

  return (
    <div
      className={cn(
        'rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_6px_16px_rgba(2,26,84,0.06)]',
        compact ? 'p-3' : 'p-4',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#021A54]">Stamp sound</p>
          {!compact ? (
            <p className="mt-0.5 text-[11px] leading-relaxed text-[#64748B]">
              Plays when you collect a stamp or send a reward. Adjust volume or mute anytime.
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] text-[#94A3B8]">
              {muted ? 'Muted' : `${Math.round(volume * 100)}% volume`}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleMuteToggle}
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition',
            muted
              ? 'bg-[#FEF2F2] text-[#DC2626]'
              : 'bg-[#EFF6FF] text-[#021A54] hover:bg-[#DBEAFE]'
          )}
          aria-label={muted ? 'Unmute stamp sound' : 'Mute stamp sound'}
          aria-pressed={muted}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="customer-stamp-sound-volume">
          Stamp sound volume
        </label>
        <input
          id="customer-stamp-sound-volume"
          type="range"
          min={0}
          max={100}
          step={1}
          disabled={muted}
          value={Math.round(volume * 100)}
          onChange={(e) => handleVolumeChange(e.target.value)}
          className="h-2 w-full max-w-[220px] flex-1 cursor-pointer accent-[#021A54] disabled:opacity-40"
        />
        <span className="min-w-[2.75rem] text-sm font-bold text-[#021A54]">
          {muted ? 'Off' : `${Math.round(volume * 100)}%`}
        </span>
        <button
          type="button"
          onClick={handlePreview}
          disabled={muted}
          className="rounded-xl border border-[#D0D5DD] bg-white px-3 py-2 text-xs font-bold text-[#021A54] hover:bg-[#F8FAFC] disabled:opacity-40"
        >
          Preview
        </button>
      </div>
    </div>
  );
}
