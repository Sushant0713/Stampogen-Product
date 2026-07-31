'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { superAdminDashboardService } from '@/services/superAdminDashboard.service';
import { getErrorMessage } from '@/utils';

export const PERIODS = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '3 months' },
  { value: 365, label: '12 months' },
];

export const LIVE_REFRESH_MS = 15000;

export const PLAN_COLORS = ['#021A54', '#2563EB', '#14B8A6', '#F59E0B', '#8B5CF6', '#EC4899'];

export const PAYMENT_COLORS = {
  paid: '#16A34A',
  free: '#2563EB',
  created: '#F59E0B',
  failed: '#DC2626',
};

export function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgoInputValue(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - (days - 1));
  return date.toISOString().slice(0, 10);
}

export function money(value, compact = false) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 2,
  }).format(Number(value) || 0);
}

export function number(value, compact = false) {
  return new Intl.NumberFormat('en-IN', {
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
  }).format(Number(value) || 0);
}

export function shortDate(value) {
  if (!value) return '';
  const date = new Date(value.length === 7 ? `${value}-01T00:00:00Z` : `${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', {
    month: 'short',
    day: value.length === 7 ? undefined : 'numeric',
  });
}

export function timeAgo(value) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 'Recently';
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function Trend({ value }) {
  const change = Number(value) || 0;
  const positive = change >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-[11px] font-bold ${
        positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
      }`}
    >
      {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}

export function KpiCard({ label, value, helper, icon: Icon, trend, tone = 'navy', href }) {
  const toneClass = {
    navy: 'bg-[#EAF0FF] text-[#021A54]',
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    violet: 'bg-violet-50 text-violet-700',
  }[tone];

  const content = (
    <>
      <div className="flex items-start justify-between">
        <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${toneClass}`}>
          <Icon size={19} />
        </div>
        {trend != null ? <Trend value={trend} /> : null}
      </div>
      <p className="mt-5 text-[13px] font-semibold text-[#667085]">{label}</p>
      <p className="mt-1 font-display text-[28px] font-bold tracking-tight text-[#101828]">
        {value}
      </p>
      <p className="mt-1 text-[12px] font-medium text-[#98A2B3]">{helper}</p>
    </>
  );

  const className =
    'group rounded-2xl border border-[#E8ECF2] bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.04)] transition hover:-translate-y-0.5 hover:border-[#C9D4EB] hover:shadow-[0_12px_28px_rgba(2,26,84,0.08)]';

  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

export function ChartTooltip({ active, payload, label, moneyValues = false }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-white px-3 py-2 shadow-xl">
      <p className="mb-1 text-[11px] font-semibold text-[#667085]">{shortDate(label)}</p>
      {payload.map((item) => (
        <div key={item.dataKey} className="flex min-w-[140px] items-center justify-between gap-4">
          <span className="text-[12px] capitalize text-[#667085]">{item.name}</span>
          <span className="text-[12px] font-bold text-[#101828]">
            {moneyValues ? money(item.value) : number(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function SectionCard({ title, subtitle, action, children, className = '' }) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-[#E8ECF2] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.04)] ${className}`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-[#F0F2F5] px-5 py-4">
        <div>
          <h2 className="text-[16px] font-bold text-[#101828]">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-[12px] text-[#667085]">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyChart({ text, heightClass = 'h-[260px]' }) {
  return (
    <div className={`flex items-center justify-center text-sm font-medium text-[#98A2B3] ${heightClass}`}>
      {text}
    </div>
  );
}

export function StatusPill({ status }) {
  const classes = {
    paid: 'bg-emerald-50 text-emerald-700',
    free: 'bg-blue-50 text-blue-700',
    active: 'bg-emerald-50 text-emerald-700',
    created: 'bg-amber-50 text-amber-700',
    pending: 'bg-amber-50 text-amber-700',
    failed: 'bg-red-50 text-red-700',
    suspended: 'bg-red-50 text-red-700',
    inactive: 'bg-slate-100 text-slate-600',
  };
  return (
    <span
      className={`rounded-full px-2 py-1 text-[10px] font-bold capitalize ${
        classes[status] || 'bg-slate-100 text-slate-600'
      }`}
    >
      {status || 'unknown'}
    </span>
  );
}

export function AnalyticsHero({
  eyebrow,
  title,
  description,
  rangeLabel,
  lastUpdated,
  live,
  setLive,
  period,
  customRange,
  dateFrom,
  dateTo,
  applyPreset,
  applyCustomDates,
  onRefresh,
  refreshing,
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-[#021A54] px-6 py-6 text-white shadow-[0_22px_45px_rgba(2,26,84,0.22)] sm:px-8 sm:py-7">
      <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-cyan-400/10 blur-2xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-blue-200">{eyebrow}</p>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                live ? 'bg-emerald-400/20 text-emerald-100' : 'bg-white/10 text-blue-100'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${live ? 'animate-pulse bg-emerald-300' : 'bg-blue-200'}`}
              />
              {live ? 'Live' : 'Paused'}
            </span>
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-100/80">{description}</p>
          <p className="mt-2 text-[11px] font-medium text-blue-200/80">
            Showing {rangeLabel}
            {lastUpdated
              ? ` · Updated ${lastUpdated.toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}`
              : ''}
          </p>
        </div>
        <div className="flex w-full max-w-xl flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-white/10 p-1 backdrop-blur">
              {PERIODS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => applyPreset(option.value)}
                  className={`rounded-lg px-3 py-2 text-[12px] font-bold transition ${
                    !customRange && period === option.value
                      ? 'bg-white text-[#021A54] shadow-sm'
                      : 'text-blue-100 hover:bg-white/10'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setLive((prev) => !prev)}
              className="inline-flex h-10 items-center rounded-xl bg-white/10 px-3 text-[12px] font-bold text-white transition hover:bg-white/20"
            >
              {live ? 'Pause live' : 'Go live'}
            </button>
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="rounded-xl bg-white/10 px-3 py-2 backdrop-blur">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-blue-200">
                From
              </span>
              <input
                type="date"
                value={dateFrom}
                max={dateTo || todayInputValue()}
                onChange={(e) => applyCustomDates(e.target.value, dateTo)}
                className="w-full border-0 bg-transparent p-0 text-[13px] font-semibold text-white outline-none [color-scheme:dark]"
                aria-label="From date"
              />
            </label>
            <label className="rounded-xl bg-white/10 px-3 py-2 backdrop-blur">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-blue-200">
                To
              </span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                max={todayInputValue()}
                onChange={(e) => applyCustomDates(dateFrom, e.target.value)}
                className="w-full border-0 bg-transparent p-0 text-[13px] font-semibold text-white outline-none [color-scheme:dark]"
                aria-label="To date"
              />
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}

export function useSuperAdminAnalytics({ errorMessage = 'Unable to load analytics' } = {}) {
  const [period, setPeriod] = useState(30);
  const [dateFrom, setDateFrom] = useState(() => daysAgoInputValue(30));
  const [dateTo, setDateTo] = useState(() => todayInputValue());
  const [customRange, setCustomRange] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [live, setLive] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadDashboard = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (silent) setRefreshing(true);
        else setLoading(true);
        const params =
          customRange && dateFrom && dateTo ? { from: dateFrom, to: dateTo } : { period };
        const { data } = await superAdminDashboardService.get(params);
        setDashboard(data.data.dashboard);
        setLastUpdated(new Date());
      } catch (error) {
        if (!silent) toast.error(getErrorMessage(error, errorMessage));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [period, customRange, dateFrom, dateTo, errorMessage]
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!live) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadDashboard({ silent: true });
      }
    }, LIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [live, loadDashboard]);

  useEffect(() => {
    const onFocus = () => loadDashboard({ silent: true });
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onFocus();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loadDashboard]);

  const applyPreset = (days) => {
    setCustomRange(false);
    setPeriod(days);
    setDateFrom(daysAgoInputValue(days));
    setDateTo(todayInputValue());
  };

  const applyCustomDates = (from, to) => {
    let nextFrom = from;
    let nextTo = to;
    if (nextFrom && nextTo && nextFrom > nextTo) {
      nextFrom = to;
      nextTo = from;
    }
    setDateFrom(nextFrom);
    setDateTo(nextTo);
    setCustomRange(Boolean(nextFrom && nextTo));
  };

  const rangeLabel = customRange
    ? `${dateFrom} → ${dateTo}`
    : PERIODS.find((item) => item.value === period)?.label || `${period} days`;

  return {
    period,
    dateFrom,
    dateTo,
    customRange,
    dashboard,
    loading,
    refreshing,
    live,
    setLive,
    lastUpdated,
    loadDashboard,
    applyPreset,
    applyCustomDates,
    rangeLabel,
  };
}
