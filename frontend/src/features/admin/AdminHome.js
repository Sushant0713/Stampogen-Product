'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { getErrorMessage, getLoginPath } from '@/utils';
import { ROLES } from '@/constants';
import { adminCardClass } from '@/features/admin/adminTheme';
import { LoyaltyQrImage, buildJoinUrl, printLoyaltyQr } from '@/features/customer/LoyaltyQrImage';
import { loyaltyService } from '@/services/loyalty.service';

function QrScanTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const count = payload[0]?.value ?? 0;
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 shadow-[0_10px_24px_rgba(2,26,84,0.12)]">
      <p className="text-[11px] font-semibold text-[#94A3B8]">Day {label}</p>
      <p className="text-sm font-extrabold text-[#021A54]">
        {count} scan{count === 1 ? '' : 's'}
      </p>
    </div>
  );
}
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning ☀️';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening 🌙';
}

const WELCOME_SEEN_PREFIX = 'stampogen:admin-welcome-seen:v1:';

function hasSeenWelcome(userId) {
  if (typeof window === 'undefined' || !userId) return true;
  try {
    return window.localStorage.getItem(`${WELCOME_SEEN_PREFIX}${userId}`) === '1';
  } catch {
    return true;
  }
}

function markWelcomeSeen(userId) {
  if (typeof window === 'undefined' || !userId) return;
  try {
    window.localStorage.setItem(`${WELCOME_SEEN_PREFIX}${userId}`, '1');
  } catch {
    // ignore
  }
}

function trialBannerText(sub) {
  if (!sub?.planName) return null;
  const isTrial =
    sub.isTrial ||
    sub.source === 'trial' ||
    ['trial_active', 'trial_expiring_soon', 'trial_expired'].includes(sub.status);
  if (!isTrial) return null;

  const days = sub.daysRemaining;
  if (days == null) return `${sub.planName} free trial`;
  if (days < 0) {
    return `Free trial ended ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
  }
  if (days === 0) return `${sub.planName} free trial ends today`;
  return `${days} day${days === 1 ? '' : 's'} free trial remaining`;
}

function firstName(fullName) {
  const n = String(fullName || '').trim();
  if (!n) return 'there';
  return n.split(/\s+/)[0];
}

function initials(fullName) {
  const parts = String(fullName || 'A').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'A';
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export function AdminHome() {
  const router = useRouter();
  const { logout } = useAuth();
  const { fullName, user } = useUser();
  const sub = user?.subscription || user?.tenant?.subscription || null;
  const shopName = user?.tenant?.name || 'your shop';
  const tenantSlug = user?.tenant?.slug || '';
  const joinUrl = useMemo(
    () => (tenantSlug ? buildJoinUrl(tenantSlug) : ''),
    [tenantSlug]
  );

  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    pendingRewards: 0,
    pendingStampRequests: 0,
    redeemedRewards: 0,
    repeatCustomers: 0,
    activeCampaigns: 0,
    qrScans: { month: '', monthLabel: '', total: 0, days: [] },
  });

  const loadStats = useCallback(async () => {
    try {
      const { data } = await loyaltyService.adminStats();
      if (data.data?.stats) setStats(data.data.stats);
    } catch {
      // Keep zeros if stats unavailable
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const displayName = useMemo(() => firstName(fullName), [fullName]);
  const userId = user?._id || user?.id || '';
  const [isReturningUser, setIsReturningUser] = useState(true);
  const trialLabel = useMemo(() => trialBannerText(sub), [sub]);

  useEffect(() => {
    if (!userId) return;
    const seen = hasSeenWelcome(userId);
    setIsReturningUser(seen);
    if (!seen) markWelcomeSeen(userId);
  }, [userId]);

  const statCards = useMemo(
    () => [
      {
        label: 'Active Campaigns',
        value: String(stats.activeCampaigns || 0),
        emoji: '🎁',
        href: '/admin/offers',
      },
      {
        label: 'Total Customers',
        value: String(stats.totalCustomers || 0),
        emoji: '👥',
        href: '/admin/customers',
      },
      {
        label: 'Pending Rewards',
        value: String(stats.pendingRewards || 0),
        emoji: '🏆',
        href: '/admin/rewards',
      },
      {
        label: 'Rewards Given',
        value: String(stats.redeemedRewards || 0),
        emoji: '✅',
        href: '/admin/rewards',
      },
      {
        label: 'Repeat Customers',
        value: String(stats.repeatCustomers || 0),
        emoji: '🔁',
        href: '/admin/customers',
        title: 'Customers who collected a stamp, then came back for another',
      },
    ],
    [stats]
  );

  const qrScans = stats.qrScans || { monthLabel: '', total: 0, days: [] };
  const qrChartData = useMemo(
    () =>
      (qrScans.days || []).map((d) => ({
        day: d.label || String(d.day),
        scans: Number(d.count) || 0,
        date: d.date,
      })),
    [qrScans.days]
  );

  const handlePrintQr = async () => {
    if (!joinUrl) {
      toast.error('Loyalty QR is not ready yet');
      return;
    }
    try {
      await printLoyaltyQr({ value: joinUrl, shopName });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not print QR'));
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 lg:max-w-none lg:gap-8">
      {/* Header */}
      <div className="flex flex-col gap-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-[#F59E0B]">{greeting()}</p>
            <h1 className="mt-1.5 text-[26px] font-extrabold leading-tight text-[#021A54] lg:text-3xl">
              {isReturningUser ? 'Welcome back,' : 'Welcome,'}
              <br />
              <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span>
                  {displayName} 👋
                </span>
                {trialLabel ? (
                  <span className="text-[14px] font-bold leading-snug text-[#D92D20] lg:text-[16px]">
                    {trialLabel}
                  </span>
                ) : null}
              </span>
            </h1>
          </div>
          <div className="relative flex shrink-0 gap-2.5">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((v) => !v);
                  setProfileOpen(false);
                }}
                data-tour="admin-notifications"
                className="relative flex h-11 w-11 items-center justify-center rounded-[14px] bg-white shadow-[0_6px_16px_rgba(2,26,84,0.08)] active:scale-95"
                aria-label="Notifications"
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M12 3C9 3 6.5 5.5 6.5 8.5V12.2C6.5 13 6.2 13.8 5.6 14.4L4.5 15.6C3.8 16.4 4.3 17.7 5.4 17.7H18.6C19.7 17.7 20.2 16.4 19.5 15.6L18.4 14.4C17.8 13.8 17.5 13 17.5 12.2V8.5C17.5 5.5 15 3 12 3Z"
                    stroke="#021A54"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9.5 20.5C10 21.3 10.9 21.8 12 21.8C13.1 21.8 14 21.3 14.5 20.5"
                    stroke="#021A54"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
                {(stats.pendingRewards > 0 || stats.pendingStampRequests > 0) ? (
                  <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full border-2 border-white bg-[#F59E0B]" />
                ) : null}
              </button>
              {notifOpen ? (
                <div className="absolute right-0 top-[52px] z-30 w-[236px] rounded-2xl bg-white p-3.5 shadow-[0_16px_40px_rgba(2,26,84,0.18)]">
                  <p className="text-xs font-bold text-[#021A54]">Notifications</p>
                  {stats.pendingStampRequests > 0 || stats.pendingRewards > 0 ? (
                    <div className="mt-2 flex flex-col gap-2">
                      {stats.pendingStampRequests > 0 ? (
                        <Link
                          href="/admin/rewards"
                          className="text-[12.5px] leading-snug text-[#64748B] hover:text-[#021A54]"
                          onClick={() => setNotifOpen(false)}
                        >
                          {stats.pendingStampRequests} stamp request
                          {stats.pendingStampRequests === 1 ? '' : 's'} waiting for approval.
                        </Link>
                      ) : null}
                      {stats.pendingRewards > 0 ? (
                        <Link
                          href="/admin/rewards"
                          className="text-[12.5px] leading-snug text-[#64748B] hover:text-[#021A54]"
                          onClick={() => setNotifOpen(false)}
                        >
                          {stats.pendingRewards} reward
                          {stats.pendingRewards === 1 ? '' : 's'} waiting for verification.
                        </Link>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-2 text-[12.5px] leading-snug text-[#64748B]">
                      No new notifications.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => {
                setProfileOpen((v) => !v);
                setNotifOpen(false);
              }}
              className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#021A54] text-[15px] font-bold text-white shadow-[0_6px_16px_rgba(2,26,84,0.18)] active:scale-95"
              aria-label="Account menu"
            >
              {initials(fullName)}
            </button>
            {profileOpen ? (
              <div className="absolute right-0 top-[52px] z-30 flex w-40 flex-col overflow-hidden rounded-2xl bg-white p-2 shadow-[0_16px_40px_rgba(2,26,84,0.18)]">
                <Link
                  href="/admin/profile"
                  className="rounded-[10px] px-2.5 py-2 text-[13px] font-semibold text-[#021A54] hover:bg-[#F1F5F9]"
                  onClick={() => setProfileOpen(false)}
                >
                  Profile
                </Link>
                <Link
                  href="/admin/plans/my"
                  className="rounded-[10px] px-2.5 py-2 text-[13px] font-semibold text-[#021A54] hover:bg-[#F1F5F9]"
                  onClick={() => setProfileOpen(false)}
                >
                  My plan
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-[10px] px-2.5 py-2 text-left text-[13px] font-semibold text-red-500 hover:bg-[#F1F5F9]"
                >
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <p className="text-[13.5px] font-medium text-[#64748B]">
          Here&apos;s today&apos;s business overview for {shopName}.
        </p>
      </div>

      {/* QR card */}
      <div data-tour="admin-qr" className={adminCardClass('flex items-center gap-4 p-[18px]')}>
        {tenantSlug && joinUrl ? (
          <div className="flex h-[76px] w-[76px] shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-white p-1 shadow-[0_4px_10px_rgba(2,26,84,0.15)]">
            <LoyaltyQrImage value={joinUrl} size={72} className="rounded-[10px]" />
          </div>
        ) : (
          <div
            className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#021A54] to-[#3B82F6] shadow-[0_4px_10px_rgba(2,26,84,0.15)]"
            aria-hidden
          >
            <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] bg-white text-[8px] font-extrabold text-[#021A54]">
              QR
            </div>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-[#021A54]">Your Loyalty QR</p>
          <p className="mt-0.5 text-[11px] font-semibold text-[#94A3B8]">
            Display at checkout for customers to scan.
          </p>
          {joinUrl ? (
            <p className="mt-1 truncate text-[10px] font-medium text-[#CBD5E1]" title={joinUrl}>
              {joinUrl}
            </p>
          ) : null}
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={handlePrintQr}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[#021A54] py-2 text-[11.5px] font-bold text-white active:scale-95"
            >
              <Printer size={12} />
              Print QR
            </button>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] py-2 text-[11.5px] font-bold text-[#021A54] active:scale-95"
            >
              <Eye size={13} />
              Preview
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5 lg:gap-3">
        {statCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            title={card.title}
            className={adminCardClass(
              'flex flex-col gap-1.5 p-2.5 shadow-[0_6px_14px_rgba(2,26,84,0.06)] transition active:scale-[0.98] lg:p-4'
            )}
          >
            <span className="text-2xl" aria-hidden>
              {card.emoji}
            </span>
            <span className="text-lg font-extrabold text-[#021A54] lg:text-xl">{card.value}</span>
            <span className="text-[10px] font-semibold text-[#94A3B8]">{card.label}</span>
          </Link>
        ))}
      </div>

      {/* QR scans — current month graph (auto-resets next month) */}
      <div className={adminCardClass('p-4 lg:p-5')}>
        <div className="mb-1 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-extrabold text-[#021A54]">QR scans this month</p>
            <p className="mt-0.5 text-[11px] font-medium text-[#94A3B8]">
              {qrScans.monthLabel || 'Current month'} · resets automatically next month
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-extrabold text-[#021A54]">{qrScans.total || 0}</p>
            <p className="text-[10px] font-semibold text-[#94A3B8]">Total scans</p>
          </div>
        </div>

        {qrChartData.length === 0 ? (
          <p className="py-10 text-center text-[12px] text-[#94A3B8]">
            No QR scans recorded yet this month.
          </p>
        ) : (
          <div className="mt-2 h-[220px] w-full sm:h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={qrChartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="qrScanFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#EEF1F5" strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  minTickGap={18}
                  tick={{ fill: '#94A3B8', fontSize: 11 }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                  tick={{ fill: '#94A3B8', fontSize: 11 }}
                />
                <Tooltip content={<QrScanTooltip />} />
                <Area
                  type="monotone"
                  dataKey="scans"
                  name="Scans"
                  stroke="#021A54"
                  strokeWidth={2.5}
                  fill="url(#qrScanFill)"
                  dot={false}
                  activeDot={{ r: 5, fill: '#3B82F6', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Upgrade banner */}
      <div className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#021A54] via-[#0C3A9C] to-[#3B82F6] p-[22px] shadow-[0_18px_40px_rgba(2,26,84,0.32)]">
        <div className="pointer-events-none absolute -right-8 -top-8 h-[150px] w-[150px] rounded-full bg-white/10" />
        <div className="pointer-events-none absolute bottom-[-40px] right-8 h-[90px] w-[90px] rounded-full bg-white/[0.06]" />
        <p className="relative text-[19px] font-extrabold text-white">Unlock Premium</p>
        <p className="relative mt-2 max-w-md text-[13px] leading-relaxed text-white/80">
          {sub?.planName
            ? `You're on ${sub.planName}. Upgrade for unlimited campaigns, AI insights, and advanced analytics.`
            : 'Increase retention with unlimited campaigns, AI insights, advanced analytics and marketing automation.'}
        </p>
        <Link
          href="/admin/plans/browse"
          className="relative mt-3.5 inline-flex items-center gap-1.5 rounded-[14px] bg-white px-5 py-3 text-sm font-bold text-[#021A54] shadow-[0_8px_20px_rgba(0,0,0,0.15)] active:scale-[0.98]"
        >
          {sub?.planName ? 'Browse plans' : 'Upgrade now'} →
        </Link>
      </div>

      {/* Activity */}
      <div>
        <h2 className="mb-3.5 text-base font-extrabold text-[#021A54]">Recent Activity</h2>
        <div className={adminCardClass('px-4 py-8 text-center')}>
          <p className="text-sm font-semibold text-[#64748B]">
            {stats.totalCustomers === 0
              ? 'No customer activity yet. Share your loyalty QR to get started.'
              : stats.pendingRewards > 0
                ? `${stats.pendingRewards} customer${stats.pendingRewards === 1 ? '' : 's'} waiting on Rewards.`
                : `${stats.totalCustomers} loyalty customer${stats.totalCustomers === 1 ? '' : 's'} connected.`}
          </p>
          {stats.pendingRewards > 0 ? (
            <Link
              href="/admin/rewards"
              className="mt-3 inline-flex text-sm font-bold text-[#3B82F6] hover:underline"
            >
              Review rewards →
            </Link>
          ) : null}
        </div>
      </div>

      {/* QR preview modal */}
      {previewOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(2,26,84,0.55)] p-8 backdrop-blur-sm"
          onClick={() => setPreviewOpen(false)}
          role="presentation"
        >
          <div
            className="flex w-[260px] flex-col items-center gap-3.5 rounded-2xl bg-white p-6 shadow-[0_30px_60px_rgba(0,0,0,0.35)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-preview-title"
          >
            <span className="text-[10.5px] font-bold tracking-widest text-[#94A3B8]">
              PRINT PREVIEW
            </span>
            {joinUrl ? (
              <LoyaltyQrImage
                value={joinUrl}
                size={120}
                className="rounded-[10px] shadow-[0_4px_10px_rgba(2,26,84,0.15)]"
              />
            ) : (
              <div
                className="h-[120px] w-[120px] rounded-[10px] shadow-[0_4px_10px_rgba(2,26,84,0.15)]"
                style={{
                  background:
                    'repeating-conic-gradient(#021A54 0% 25%, #fff 0% 50%) 0 0/16px 16px',
                }}
              />
            )}
            <div className="text-center">
              <p id="qr-preview-title" className="text-[15px] font-extrabold text-[#021A54]">
                Scan &amp; Earn Rewards
              </p>
              <p className="mt-1 text-[11px] font-medium text-[#64748B]">
                Stampogen Loyalty · {shopName}
              </p>
            </div>
            <div className="h-px w-full bg-[#E2E8F0]" />
            <p className="text-[10px] font-semibold text-[#94A3B8]">Powered by Stampogen</p>
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="mt-1 w-full rounded-[10px] bg-[#021A54] py-2.5 text-xs font-bold text-white"
            >
              Close Preview
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
