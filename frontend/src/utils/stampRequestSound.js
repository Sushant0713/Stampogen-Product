/** Cache-bust so browsers pick up updated chimes. */
const SOUND_SRC = '/sounds/stamp-request.wav?v=3';

const STORAGE_KEY = 'stampogen.stampRequestSoundVolume';
const UNLOCK_EVENT = 'stampogen:stamp-sound-unlock';

/** Default start volume — loud but not clipped. */
export const DEFAULT_STAMP_SOUND_VOLUME = 0.95;

let audioEl = null;
let unlocked = false;
let unlockBound = false;
let unlockPromise = null;

function clampVolume(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_STAMP_SOUND_VOLUME;
  return Math.min(1, Math.max(0, n));
}

export function getStampRequestSoundVolume() {
  if (typeof window === 'undefined') return DEFAULT_STAMP_SOUND_VOLUME;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null || raw === '') return DEFAULT_STAMP_SOUND_VOLUME;
    return clampVolume(raw);
  } catch {
    return DEFAULT_STAMP_SOUND_VOLUME;
  }
}

export function setStampRequestSoundVolume(value) {
  const next = clampVolume(value);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Ignore quota / private mode
    }
  }
  if (audioEl) {
    audioEl.volume = next;
  }
  return next;
}

function getAudio() {
  if (typeof window === 'undefined') return null;
  if (!audioEl) {
    audioEl = new Audio(SOUND_SRC);
    audioEl.preload = 'auto';
    audioEl.setAttribute('playsinline', 'true');
    audioEl.setAttribute('webkit-playsinline', 'true');
  }
  audioEl.volume = getStampRequestSoundVolume();
  return audioEl;
}

export function isStampRequestSoundUnlocked() {
  return unlocked;
}

function markUnlocked() {
  if (unlocked) return;
  unlocked = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(UNLOCK_EVENT));
  }
}

/**
 * Unlock WebAudio / HTMLAudio after a user gesture (required on mobile Chrome).
 * Safe to call multiple times; subsequent calls are no-ops.
 */
export async function unlockStampRequestSound() {
  if (typeof window === 'undefined') return false;
  if (unlocked) return true;
  if (unlockPromise) return unlockPromise;

  unlockPromise = (async () => {
    try {
      const audio = getAudio();
      if (!audio) return false;

      // Silent unlock: play muted, then reset so later notifications can play aloud.
      const previousVolume = audio.volume;
      audio.muted = true;
      audio.volume = 0;
      try {
        audio.currentTime = 0;
      } catch {
        // ignore seek errors before metadata
      }
      await audio.play();
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch {
        // ignore
      }
      audio.muted = false;
      audio.volume = previousVolume || getStampRequestSoundVolume();
      markUnlocked();
      return true;
    } catch {
      return false;
    } finally {
      unlockPromise = null;
    }
  })();

  return unlockPromise;
}

/**
 * Bind one-time listeners so the first tap/click/keypress unlocks notification audio.
 * Call once from the admin shell.
 */
export function installStampSoundUnlock() {
  if (typeof window === 'undefined' || unlockBound || unlocked) return () => {};

  unlockBound = true;
  const events = ['pointerdown', 'touchstart', 'click', 'keydown'];

  const onGesture = () => {
    void unlockStampRequestSound().then((ok) => {
      if (ok) {
        events.forEach((name) => window.removeEventListener(name, onGesture, true));
      }
    });
  };

  events.forEach((name) => window.addEventListener(name, onGesture, { capture: true, passive: true }));

  return () => {
    events.forEach((name) => window.removeEventListener(name, onGesture, true));
    unlockBound = false;
  };
}

export function subscribeStampSoundUnlock(listener) {
  if (typeof window === 'undefined') return () => {};
  const handler = () => listener?.(true);
  window.addEventListener(UNLOCK_EVENT, handler);
  return () => window.removeEventListener(UNLOCK_EVENT, handler);
}

/** Soft Stampogen chime for new admin stamp-request / bill toasts. */
export function playStampRequestSound() {
  try {
    const audio = getAudio();
    if (!audio) return;

    const run = () => {
      audio.muted = false;
      audio.volume = getStampRequestSoundVolume();
      try {
        audio.currentTime = 0;
      } catch {
        // ignore
      }
      void audio.play().then(() => {
        markUnlocked();
      }).catch(() => {
        // Still blocked — toast continues without sound.
      });
    };

    if (!unlocked) {
      // Best-effort: if this call happens inside a gesture, unlock first.
      void unlockStampRequestSound().then((ok) => {
        if (ok) run();
      });
      return;
    }

    run();
  } catch {
    // Ignore audio errors — toast still shows.
  }
}
