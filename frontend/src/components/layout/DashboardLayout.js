'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { Navbar } from '@/components/navbar/Navbar';
import { PageLoader } from '@/components/loaders/Spinner';
import { useAuth } from '@/contexts/AuthContext';
import { cn, getLoginPath } from '@/utils';

export function DashboardLayout({ children, role }) {
  const router = useRouter();
  const { user, loading, initialized, role: userRole } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const authReady = initialized && !loading && Boolean(user) && userRole === role;

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
      router.replace(getLoginPath(role));
      return;
    }

    if (userRole !== role) {
      router.replace(`/${userRole}/dashboard`);
    }
  }, [initialized, loading, user, userRole, role, router]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setCollapsed(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    <div className="dashboard-shell">
      <div className="hidden lg:block">
        <Sidebar role={role} collapsed={collapsed} onToggle={toggleCollapsed} />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 h-full w-sidebar">
            <Sidebar role={role} collapsed={false} onToggle={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div
        className={cn(
          'dashboard-main',
          collapsed ? 'lg:ml-sidebar-collapsed' : 'lg:ml-sidebar'
        )}
      >
        <Navbar role={role} onMenuClick={() => setMobileOpen(true)} />
        <main className="dashboard-content">
          {authReady ? children : <PageLoader />}
        </main>
      </div>
    </div>
  );
}
