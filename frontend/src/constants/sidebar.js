import {
  LayoutDashboard,
  Home,
  Users,
  Handshake,
  Package,
  BarChart3,
  Wallet,
  FileText,
  Settings,
  LifeBuoy,
  Gift,
  Trophy,
  UserCircle,
  QrCode,
} from 'lucide-react';
import { ROLES } from '@/constants';

const withBasePath = (basePath, items) =>
  items.map((item) => ({
    ...item,
    href: item.href ? `${basePath}/${item.href}` : undefined,
    children: item.children
      ? item.children.map((child) => ({
          ...child,
          href: `${basePath}/${child.href}`,
        }))
      : undefined,
  }));

export const SIDEBAR_CONFIG = {
  [ROLES.SUPER_ADMIN]: {
    title: 'Super Admin',
    basePath: '/super-admin',
    items: withBasePath('/super-admin', [
      { label: 'Dashboard', href: 'dashboard', icon: LayoutDashboard },
      {
        label: 'Client',
        icon: Users,
        children: [{ label: 'Client list', href: 'clients' }],
      },
      {
        label: 'Affiliate',
        icon: Handshake,
        children: [
          { label: 'Affiliate list', href: 'affiliates' },
          { label: 'Pending Affiliate', href: 'affiliates/pending', badgeKey: 'pendingApprovals' },
          { label: 'Redeem', href: 'affiliates/redeem', badgeKey: 'pendingRedeems' },
          { label: 'Affiliate Settings', href: 'affiliates/settings' },
        ],
      },
      {
        label: 'Plans',
        icon: Package,
        children: [
          { label: 'Plan list', href: 'plans' },
          { label: 'Discount', href: 'discounts' },
          { label: 'Feature list', href: 'features' },
        ],
      },
      { label: 'Reports', href: 'reports', icon: BarChart3 },
      { label: 'Revenue', href: 'revenue', icon: Wallet },
      { label: 'Platform Invoice', href: 'platform-invoice', icon: FileText },
      {
        label: 'Settings',
        icon: Settings,
        children: [
          { label: 'Invoice setting', href: 'settings/invoice' },
          { label: 'Terms and conditions', href: 'settings/terms' },
        ],
      },
      {
        label: 'QR',
        icon: QrCode,
        children: [
          { label: 'QR codes', href: 'settings/qr' },
          { label: 'QR Reports', href: 'settings/qr/reports' },
        ],
      },
      { label: 'Support Ticket', href: 'support-tickets', icon: LifeBuoy },
    ]),
  },
  [ROLES.ADMIN]: {
    title: 'Admin',
    basePath: '/admin',
    items: withBasePath('/admin', [
      { label: 'Home', href: 'dashboard', icon: Home },
      { label: 'Offers', href: 'offers', icon: Gift },
      { label: 'Rewards', href: 'rewards', icon: Trophy },
      { label: 'Customers', href: 'customers', icon: Users },
      {
        label: 'Plans',
        icon: Package,
        children: [
          { label: 'My plan', href: 'plans/my' },
          { label: 'Browse plans', href: 'plans/browse' },
        ],
      },
      { label: 'Profile', href: 'profile', icon: UserCircle },
    ]),
  },
  [ROLES.AFFILIATE]: {
    title: 'Affiliate',
    basePath: '/affiliate',
    items: withBasePath('/affiliate', [
      { label: 'Dashboard', href: 'dashboard', icon: LayoutDashboard },
    ]),
  },
};
