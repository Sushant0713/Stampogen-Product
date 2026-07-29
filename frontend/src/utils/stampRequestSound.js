/** Cache-bust so browsers pick up updated chimes. */
const SOUND_SRC = '/sounds/stamp-request.wav?v=3';

const STORAGE_KEY = 'stampogen.stampRequestSoundVolume';
/** Default start volume — loud but not clipped. */
export const DEFAULT_STAMP_SOUND_VOLUME = 0.95;

let audioEl = null;

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
  }
  audioEl.volume = getStampRequestSoundVolume();
  return audioEl;
}

/** Soft Stampogen chime for new admin stamp-request toasts. */
export function playStampRequestSound() {
  try {
    const audio = getAudio();
    if (!audio) return;
    audio.volume = getStampRequestSoundVolume();
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Autoplay may be blocked until the admin interacts with the page.
    });
  } catch {
    // Ignore audio errors — toast still shows.
  }
}
