'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { getErrorMessage, getLoginPath } from '@/utils';
import { ROLES } from '@/constants';
import { AdminPageHeader } from '@/features/admin/AdminPageShell';
import { adminCardClass } from '@/features/admin/adminTheme';
import {
  LoyaltyStampModeSelector,
  loyaltyStampModeLabel,
} from '@/features/admin/LoyaltyStampModeSelector';
import { loyaltyService } from '@/services/loyalty.service';

function initials(fullName) {
  const parts = String(fullName || 'A').trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

function ProfileRow({ emoji, label, detail, href }) {
  const inner = (
    <>
      <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[rgba(59,130,246,0.12)] text-[15px]">
        {emoji}
      </div>
      <span className="flex-1 text-[13px] font-semibold text-[#021A54]">{label}</span>
      {detail ? (
        <span className="max-w-[120px] truncate text-xs font-semibold text-[#94A3B8]">
          {detail}
        </span>
      ) : (
        <ChevronRight size={14} className="text-[#CBD5E1]" />
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="flex items-center gap-3 border-b border-[#F1F5F9] px-4 py-3.5 last:border-0 hover:bg-[#F8FAFC]"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 border-b border-[#F1F5F9] px-4 py-3.5 last:border-0">
      {inner}
    </div>
  );
}

export function AdminProfile() {
  const router = useRouter();
  const { logout, fetchUser } = useAuth();
  const { fullName, email, user } = useUser();
  const shopName = user?.tenant?.name || 'Your shop';
  const sub = user?.subscription || user?.tenant?.subscription || null;

  const [stampMode, setStampMode] = useState(user?.tenant?.loyaltyStampMode || 'bill');
  const [savingMode, setSavingMode] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const { data } = await loyaltyService.adminGetSettings();
      if (data.data?.settings?.loyaltyStampMode) {
        setStampMode(data.data.settings.loyaltyStampMode);
      }
    } catch {
      // keep tenant value from user context
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleModeChange = async (nextMode) => {
    if (nextMode === stampMode || savingMode) return;
    try {
      setSavingMode(true);
      const { data } = await loyaltyService.adminUpdateSettings({ loyaltyStampMode: nextMode });
      const saved = data.data?.settings?.loyaltyStampMode || nextMode;
      setStampMode(saved);
      await fetchUser();
      toast.success(
        saved === 'request'
          ? 'Stamp requests enabled — customers will ask you to approve stamps.'
          : 'Bill scanner enabled — customers will photograph bills.'
      );
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to update stamp mode'));
    } finally {
      setSavingMode(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out');
      router.push(getLoginPath(ROLES.ADMIN));
    } catch (error) {
      toast.error(getErrorMessage(error, 'Logout failed'));
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl lg:max-w-none">
      <AdminPageHeader title="Profile" />

      <div className="relative mb-5 overflow-hidden rounded-[20px] bg-gradient-to-br from-[#021A54] to-[#3B82F6] p-5 shadow-[0_16px_34px_rgba(2,26,84,0.24)]">
        <div className="pointer-events-none absolute -right-5 -top-8 h-[110px] w-[110px] rounded-full bg-white/10" />
        <div className="relative flex items-center gap-3.5">
          <div className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-full bg-white/20 text-xl font-extrabold text-white">
            {initials(fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-extrabold text-white">{shopName}</p>
            <p className="truncate text-[11.5px] font-medium text-white/75">{email}</p>
            {sub?.planName ? (
              <p className="mt-0.5 text-[11.5px] font-semibold text-[#FCD34D]">
                Plan: {sub.planName}
                {sub.daysRemaining != null ? ` · ${sub.daysRemaining}d left` : ''}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <p className="mb-2.5 pl-0.5 text-xs font-extrabold tracking-wide text-[#94A3B8]">
        LOYALTY
      </p>
      <div className={adminCardClass('mb-5 p-4')}>
        <p className="mb-1 text-sm font-bold text-[#021A54]">Stamp collection type</p>
        <p className="mb-3 text-xs text-[#64748B]">
          Current: {loyaltyStampModeLabel(stampMode)}. Changes apply immediately for new customer
          visits.
        </p>
        <LoyaltyStampModeSelector
          value={stampMode}
          onChange={handleModeChange}
          disabled={savingMode}
        />
      </div>

      <p className="mb-2.5 pl-0.5 text-xs font-extrabold tracking-wide text-[#94A3B8]">
        SUBSCRIPTION
      </p>
      <div className={adminCardClass('mb-5 overflow-hidden')}>
        <ProfileRow emoji="📦" label="My plan" href="/admin/plans/my" />
        <ProfileRow emoji="✨" label="Browse plans" href="/admin/plans/browse" />
      </div>

      <p className="mb-2.5 pl-0.5 text-xs font-extrabold tracking-wide text-[#94A3B8]">
        BUSINESS DETAILS
      </p>
      <div className={adminCardClass('mb-5 overflow-hidden')}>
        <ProfileRow emoji="✉️" label="Email address" detail={email || '—'} />
        <ProfileRow emoji="👤" label="Account name" detail={fullName || '—'} />
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 py-3.5 text-sm font-bold text-red-600 active:scale-[0.99]"
      >
        <LogOut size={18} />
        Log out
      </button>
    </div>
  );
}
