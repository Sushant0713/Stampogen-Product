'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { PageLoader } from '@/components/loaders/Spinner';
import { CustomerBottomNav, CustomerSidebar } from '@/features/customer/CustomerNav';
import { CUSTOMER_BG } from '@/features/customer/customerTheme';
import { useAuth } from '@/contexts/AuthContext';
import { ROLES } from '@/constants';
import { cn, getErrorMessage, getLoginPath } from '@/utils';
import { installCustomerStampSoundUnlock } from '@/utils/customerStampSound';

export function CustomerAppLayout({ children, hideNav = false }) {
  const router = useRouter();
  const { user, loading, initialized, role: userRole, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const authReady = initialized && !loading && Boolean(user) && userRole === ROLES.USER;

  useEffect(() => {
    if (!authReady) return undefined;
    return installCustomerStampSoundUnlock();
  }, [authReady]);

  useEffect(() => {
    if (!initialized || loading) return;
    if (!user) {
      router.replace(getLoginPath(ROLES.USER));
      return;
    }
    if (userRole !== ROLES.USER) {
      router.replace(`/${userRole}/dashboard`);
    }
  }, [initialized, loading, user, userRole, router]);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
      toast.success('Logged out');
      router.push(getLoginPath(ROLES.USER));
    } catch (error) {
      toast.error(getErrorMessage(error, 'Logout failed'));
    } finally {
      setLoggingOut(false);
    }
  };

  const showNav = authReady && !hideNav;
  const displayName = [user?.firstName, user?.middleName, user?.lastName].filter(Boolean).join(' ');

  return (
    <div className="min-h-screen" style={{ backgroundColor: CUSTOMER_BG }}>
      {authReady ? <CustomerSidebar /> : null}

      <div className={cn('min-h-screen', authReady ? 'lg:ml-[240px]' : '')}>
        {authReady ? (
          <header className="sticky top-0 z-30 hidden border-b border-[#E2E8F0] bg-white/90 backdrop-blur-md lg:block">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-4">
              <p className="text-sm font-semibold text-[#64748B]">Your loyalty wallet</p>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-bold text-[#021A54]">{displayName}</p>
                  <p className="text-xs text-[#94A3B8]">{user.email}</p>
                </div>
                {user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#021A54] text-sm font-bold text-white">
                    {(user.firstName || 'U')[0]}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-60"
                >
                  {loggingOut ? '…' : 'Log out'}
                </button>
              </div>
            </div>
          </header>
        ) : null}

        <main
          className={cn(
            'mx-auto min-w-0 w-full max-w-3xl overflow-x-hidden p-5 pb-28 lg:max-w-6xl lg:p-8',
            hideNav ? 'pb-8' : 'lg:pb-8'
          )}
        >
          {authReady ? children : <PageLoader />}
        </main>

        {showNav ? <CustomerBottomNav /> : null}
      </div>
    </div>
  );
}
