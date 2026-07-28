'use client';

import { usePathname } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AdminDashboardLayout } from '@/components/layout/AdminDashboardLayout';
import { ROLES } from '@/constants';

const AUTH_SEGMENTS = new Set([
  'login',
  'register',
  'forgot-password',
  'reset-password',
  'verify-email',
  'upload-agreement',
  'claim-access',
]);

/**
 * Keeps DashboardLayout mounted across portal navigations so sidebar/navbar
 * do not remount on every sidebar click (major perceived lag fix).
 * Auth pages under the same role prefix skip the shell.
 */
export function PortalLayout({ role, children }) {
  const pathname = usePathname() || '';
  const segment = pathname.split('/').filter(Boolean)[1] || '';

  if (AUTH_SEGMENTS.has(segment)) {
    return children;
  }

  if (role === ROLES.ADMIN) {
    return <AdminDashboardLayout>{children}</AdminDashboardLayout>;
  }

  return <DashboardLayout role={role}>{children}</DashboardLayout>;
}
