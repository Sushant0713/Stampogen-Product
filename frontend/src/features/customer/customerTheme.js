export const CUSTOMER_BG = '#F8FAFC';
export const CUSTOMER_ACCENT = '#021A54';

export function customerCardClass(extra = '') {
  return `rounded-2xl bg-white shadow-[0_8px_20px_rgba(2,26,84,0.06),0_1px_3px_rgba(2,26,84,0.04)] ${extra}`.trim();
}

export function buildStampDots(total, filled) {
  const dots = [];
  for (let i = 0; i < total; i += 1) {
    dots.push({ key: i, filled: i < filled, empty: i >= filled });
  }
  return dots;
}

export function shopInitials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'S';
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export function relativeTime(date) {
  if (!date) return '';
  const then = new Date(date).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}
