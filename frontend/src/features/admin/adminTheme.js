export const ADMIN_ACCENT = '#021A54';
export const ADMIN_BG = '#F8FAFC';

export const ADMIN_BOTTOM_NAV = [
  { id: 'home', label: 'Home', href: '/admin/dashboard', emoji: '🏠' },
  { id: 'offers', label: 'Offers', href: '/admin/offers', emoji: '🎁' },
  { id: 'rewards', label: 'Rewards', href: '/admin/rewards', emoji: '🏆' },
  { id: 'customers', label: 'Customers', href: '/admin/customers', emoji: '👥' },
  { id: 'profile', label: 'Profile', href: '/admin/profile', emoji: '⚙️' },
];

export function adminCardClass(extra = '') {
  return `rounded-2xl bg-white shadow-[0_10px_26px_rgba(2,26,84,0.07)] ${extra}`.trim();
}
