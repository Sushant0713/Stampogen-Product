'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/utils';
import { ADMIN_BOTTOM_NAV } from '@/features/admin/adminTheme';
import { loyaltyService } from '@/services/loyalty.service';
import { useAuth } from '@/contexts/AuthContext';

function isNavActive(pathname, href) {
  if (href === '/admin/dashboard') {
    return pathname === href || pathname === '/admin/home';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminBottomNav() {
  const pathname = usePathname() || '';
  const { user } = useAuth();
  const isOutlet = Boolean(user?.isOutlet || user?.tenant?.kind === 'outlet');
  const [rewardAlerts, setRewardAlerts] = useState(0);

  const loadAlerts = useCallback(async () => {
    try {
      const { data } = await loyaltyService.adminStats();
      const stats = data.data?.stats || {};
      setRewardAlerts(
        (Number(stats.pendingStampRequests) || 0) + (Number(stats.pendingRewards) || 0)
      );
    } catch {
      // Keep previous
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    const id = setInterval(loadAlerts, 10000);
    return () => clearInterval(id);
  }, [loadAlerts]);

  const items = isOutlet
    ? ADMIN_BOTTOM_NAV.filter((item) => item.id !== 'offers')
    : ADMIN_BOTTOM_NAV;

  return (
    <nav
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 gap-1 rounded-[26px] border border-[rgba(2,26,84,0.05)] bg-white/85 p-2 shadow-[0_16px_36px_rgba(2,26,84,0.18)] backdrop-blur-xl lg:hidden"
      aria-label="Admin navigation"
    >
      {items.map((item) => {
        const active = isNavActive(pathname, item.href);
        const showBadge = item.id === 'rewards' && rewardAlerts > 0;
        return (
          <Link
            key={item.id}
            href={item.href}
            prefetch={false}
            data-tour={`admin-${item.id === 'home' ? 'home' : item.id}`}
            className={cn(
              'relative flex min-w-[52px] flex-col items-center gap-0.5 rounded-[18px] px-3 py-2 transition active:scale-95',
              active ? 'bg-[rgba(59,130,246,0.14)]' : 'bg-transparent'
            )}
          >
            <span className="relative text-lg leading-none" aria-hidden>
              {item.emoji}
              {showBadge ? (
                <span className="absolute -right-2.5 -top-1 inline-flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#F59E0B] px-1 text-[8px] font-extrabold text-white">
                  {rewardAlerts > 9 ? '9+' : rewardAlerts}
                </span>
              ) : null}
            </span>
            <span
              className={cn(
                'text-[9px] font-bold',
                active ? 'text-[#3B82F6]' : 'text-[#94A3B8]'
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
