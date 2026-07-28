'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, LogOut, Menu, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { ROLE_LABELS, ROLES } from '@/constants';
import { getErrorMessage, getLoginPath } from '@/utils';
import { NotificationBell } from '@/components/navbar/NotificationBell';

export function Navbar({ role, onMenuClick }) {
  const router = useRouter();
  const { logout } = useAuth();
  const { fullName, email, user } = useUser();
  const [loggingOut, setLoggingOut] = useState(false);

  const discountCode =
    role === ROLES.AFFILIATE
      ? String(user?.affiliateDiscountCode || '').trim().toUpperCase()
      : '';
  const discountPercent = Number(user?.affiliateDiscountPercent) || 20;

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
      toast.success('Logged out successfully');
      router.push(getLoginPath(role));
    } catch (error) {
      toast.error(getErrorMessage(error, 'Logout failed'));
    } finally {
      setLoggingOut(false);
    }
  };

  const copyDiscountCode = async () => {
    if (!discountCode) return;
    try {
      await navigator.clipboard.writeText(discountCode);
      toast.success('Discount code copied');
    } catch {
      toast.error('Unable to copy code');
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-navbar items-center justify-between gap-3 border-b border-border bg-white px-4 md:px-6">
      <div className="flex min-w-0 shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-md p-2 text-primary hover:bg-muted lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>
        <div>
          <p className="text-sm font-medium text-foreground">{ROLE_LABELS[role]} Portal</p>
        </div>
      </div>

      {discountCode ? (
        <div className="hidden min-w-0 flex-1 items-center justify-center px-2 md:flex">
          <div className="inline-flex max-w-full items-center gap-2 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1.5">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#1E40AF]">
                Discount code · {discountPercent}% off
              </p>
              <p className="truncate font-mono text-sm font-bold text-[#021A54]">{discountCode}</p>
            </div>
            <button
              type="button"
              onClick={copyDiscountCode}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[#021A54] bg-white px-2.5 text-[12px] font-semibold text-[#021A54] hover:bg-white/90"
              title="Copy discount code"
            >
              <Copy size={14} />
              <span className="hidden lg:inline">Copy</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="hidden flex-1 md:block" />
      )}

      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        {discountCode ? (
          <button
            type="button"
            onClick={copyDiscountCode}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 text-[12px] font-semibold text-[#021A54] md:hidden"
            title={discountCode}
          >
            <Copy size={14} />
            Code
          </button>
        ) : null}

        <NotificationBell role={role} />

        <div className="hidden items-center gap-2 sm:flex">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-primary">
            <User size={16} />
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">{fullName}</p>
            <p className="text-xs text-muted-foreground">{email}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">{loggingOut ? 'Logging out...' : 'Logout'}</span>
        </button>
      </div>
    </header>
  );
}
