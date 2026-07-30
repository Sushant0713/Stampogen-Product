/** Customer celebration chime when a stamp / reward is collected. */
const SOUND_SRC = '/sounds/stamp-request.wav?v=3';

const VOLUME_KEY = 'stampogen.customerStampSoundVolume';
const MUTE_KEY = 'stampogen.customerStampSoundMuted';
const UNLOCK_EVENT = 'stampogen:customer-stamp-sound-unlock';

export const DEFAULT_CUSTOMER_STAMP_SOUND_VOLUME = 0.85;

let audioEl = null;
let unlocked = false;
let unlockBound = false;
let unlockPromise = null;

function clampVolume(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_CUSTOMER_STAMP_SOUND_VOLUME;
  return Math.min(1, Math.max(0, n));
}

export function getCustomerStampSoundVolume() {
  if (typeof window === 'undefined') return DEFAULT_CUSTOMER_STAMP_SOUND_VOLUME;
  try {
    const raw = window.localStorage.getItem(VOLUME_KEY);
    if (raw == null || raw === '') return DEFAULT_CUSTOMER_STAMP_SOUND_VOLUME;
    return clampVolume(raw);
  } catch {
    return DEFAULT_CUSTOMER_STAMP_SOUND_VOLUME;
  }
}

export function setCustomerStampSoundVolume(value) {
  const next = clampVolume(value);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(VOLUME_KEY, String(next));
    } catch {
      // ignore
    }
  }
  if (audioEl && !getCustomerStampSoundMuted()) {
    audioEl.volume = next;
  }
  return next;
}

export function getCustomerStampSoundMuted() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setCustomerStampSoundMuted(muted) {
  const next = Boolean(muted);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(MUTE_KEY, next ? '1' : '0');
    } catch {
      // ignore
    }
  }
  if (audioEl) {
    audioEl.muted = next;
    audioEl.volume = next ? 0 : getCustomerStampSoundVolume();
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
  const muted = getCustomerStampSoundMuted();
  audioEl.muted = muted;
  audioEl.volume = muted ? 0 : getCustomerStampSoundVolume();
  return audioEl;
}

export function isCustomerStampSoundUnlocked() {
  return unlocked;
}

function markUnlocked() {
  if (unlocked) return;
  unlocked = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(UNLOCK_EVENT));
  }
}

export async function unlockCustomerStampSound() {
  if (typeof window === 'undefined') return false;
  if (unlocked) return true;
  if (unlockPromise) return unlockPromise;

  unlockPromise = (async () => {
    try {
      const audio = getAudio();
      if (!audio) return false;
      const previousVolume = audio.volume;
      const wasMuted = audio.muted;
      audio.muted = true;
      audio.volume = 0;
      try {
        audio.currentTime = 0;
      } catch {
        // ignore
      }
      await audio.play();
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch {
        // ignore
      }
      audio.muted = wasMuted || getCustomerStampSoundMuted();
      audio.volume = getCustomerStampSoundMuted() ? 0 : previousVolume || getCustomerStampSoundVolume();
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

export function installCustomerStampSoundUnlock() {
  if (typeof window === 'undefined' || unlockBound || unlocked) return () => {};

  unlockBound = true;
  const events = ['pointerdown', 'touchstart', 'click', 'keydown'];

  const onGesture = () => {
    void unlockCustomerStampSound().then((ok) => {
      if (ok) {
        events.forEach((name) => window.removeEventListener(name, onGesture, true));
      }
    });
  };

  events.forEach((name) =>
    window.addEventListener(name, onGesture, { capture: true, passive: true })
  );

  return () => {
    events.forEach((name) => window.removeEventListener(name, onGesture, true));
    unlockBound = false;
  };
}

export function subscribeCustomerStampSoundUnlock(listener) {
  if (typeof window === 'undefined') return () => {};
  const handler = () => listener?.(true);
  window.addEventListener(UNLOCK_EVENT, handler);
  return () => window.removeEventListener(UNLOCK_EVENT, handler);
}

/** Play celebration chime after a successful stamp / reward (respects mute + volume). */
export function playCustomerStampSound() {
  try {
    if (getCustomerStampSoundMuted()) return;

    const audio = getAudio();
    if (!audio) return;

    const run = () => {
      if (getCustomerStampSoundMuted()) return;
      audio.muted = false;
      audio.volume = getCustomerStampSoundVolume();
      try {
        audio.currentTime = 0;
      } catch {
        // ignore
      }
      void audio
        .play()
        .then(() => markUnlocked())
        .catch(() => {});
    };

    if (!unlocked) {
      void unlockCustomerStampSound().then((ok) => {
        if (ok) run();
      });
      return;
    }

    run();
  } catch {
    // ignore — celebration visuals still show
  }
}
