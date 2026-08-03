'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { Navbar } from '@/components/navbar/Navbar';
import { PageLoader } from '@/components/loaders/Spinner';
import { AdminBottomNav } from '@/features/admin/layout/AdminBottomNav';
import { AdminStampRequestNotifier } from '@/features/admin/AdminStampRequestNotifier';
import { AdminBillStampNotifier } from '@/features/admin/AdminBillStampNotifier';
import { AdminSoundUnlock } from '@/features/admin/AdminSoundUnlock';
import { AdminOnboardingTour } from '@/features/admin/AdminOnboardingTour';
import { AdminUpgradeGate } from '@/features/admin/AdminUpgradeGate';
import { ADMIN_BG } from '@/features/admin/adminTheme';
import { useAuth } from '@/contexts/AuthContext';
import { ROLES } from '@/constants';
import {
  cn,
  getLoginPath,
  getAdminSubscriptionLock,
  isAdminUpgradeAllowedPath,
} from '@/utils';

export function AdminDashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname() || '';
  const { user, loading, initialized, role: userRole } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const authReady = initialized && !loading && Boolean(user) && userRole === ROLES.ADMIN;
  const subscriptionLock = authReady ? getAdminSubscriptionLock(user) : { locked: false };
  const showUpgradeGate =
    authReady && subscriptionLock.locked && !isAdminUpgradeAllowedPath(pathname);
  const facilitiesEnabled = authReady && !subscriptionLock.locked;

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem('stampogen.sidebar.collapsed') === '1') {
        setCollapsed(true);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!initialized || loading) return;
    if (!user) {
      router.replace(getLoginPath(ROLES.ADMIN));
      return;
    }
    if (userRole !== ROLES.ADMIN) {
      router.replace(`/${userRole}/dashboard`);
    }
  }, [initialized, loading, user, userRole, router]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.sessionStorage.setItem('stampogen.sidebar.collapsed', next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <div className="dashboard-shell min-h-screen" style={{ backgroundColor: ADMIN_BG }}>
      <div className="hidden lg:block">
        <Sidebar role={ROLES.ADMIN} collapsed={collapsed} onToggle={toggleCollapsed} />
      </div>

      <div
        className={cn(
          'dashboard-main min-h-screen',
          collapsed ? 'lg:ml-sidebar-collapsed' : 'lg:ml-sidebar'
        )}
      >
        <div className="hidden lg:block">
          <Navbar role={ROLES.ADMIN} onMenuClick={() => {}} />
        </div>
        <main
          className={cn(
            'min-w-0 flex-1 overflow-x-hidden p-4 pb-28 lg:p-8 lg:pb-8',
            'mx-auto w-full max-w-6xl'
          )}
        >
          {!authReady ? (
            <PageLoader />
          ) : showUpgradeGate ? (
            <AdminUpgradeGate lock={subscriptionLock} />
          ) : (
            children
          )}
        </main>
        {authReady ? <AdminBottomNav /> : null}
        {facilitiesEnabled ? <AdminSoundUnlock enabled /> : null}
        {facilitiesEnabled ? <AdminStampRequestNotifier enabled /> : null}
        {facilitiesEnabled ? <AdminBillStampNotifier enabled /> : null}
        {facilitiesEnabled ? <AdminOnboardingTour enabled /> : null}
      </div>
    </div>
  );
}
