'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeIndianRupee,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  FileWarning,
  Gift,
  IndianRupee,
  RefreshCw,
  Store,
  TrendingUp,
  UserPlus,
  Users,
  WalletCards,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import toast from 'react-hot-toast';
import { ContentLoader } from '@/components/loaders/Spinner';
import { useUser } from '@/contexts/UserContext';
import { superAdminDashboardService } from '@/services/superAdminDashboard.service';
import { getErrorMessage } from '@/utils';

const PERIODS = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '3 months' },
  { value: 365, label: '12 months' },
];

const LIVE_REFRESH_MS = 15000;

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoInputValue(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - (days - 1));
  return date.toISOString().slice(0, 10);
}

const PLAN_COLORS = ['#021A54', '#2563EB', '#14B8A6', '#F59E0B', '#8B5CF6', '#EC4899'];
const PAYMENT_COLORS = {
  paid: '#16A34A',
  free: '#2563EB',
  created: '#F59E0B',
  failed: '#DC2626',
};

function money(value, compact = false) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 2,
  }).format(Number(value) || 0);
}

function number(value, compact = false) {
  return new Intl.NumberFormat('en-IN', {
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
  }).format(Number(value) || 0);
}

function shortDate(value) {
  if (!value) return '';
  const date = new Date(value.length === 7 ? `${value}-01T00:00:00Z` : `${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', {
    month: 'short',
    day: value.length === 7 ? undefined : 'numeric',
  });
}

function timeAgo(value) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 'Recently';
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function firstName(value) {
  return String(value || 'Admin').trim().split(/\s+/)[0] || 'Admin';
}

function Trend({ value }) {
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

function KpiCard({ label, value, helper, icon: Icon, trend, tone = 'navy', href }) {
  const toneClass = {
    navy: 'bg-[#EAF0FF] text-[#021A54]',
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
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

function ChartTooltip({ active, payload, label, moneyValues = false }) {
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

function SectionCard({ title, subtitle, action, children, className = '' }) {
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

function EmptyChart({ text }) {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm font-medium text-[#98A2B3]">
      {text}
    </div>
  );
}

function StatusPill({ status }) {
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

export function SuperAdminDashboard() {
  const { fullName } = useUser();
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
          customRange && dateFrom && dateTo
            ? { from: dateFrom, to: dateTo }
            : { period };
        const { data } = await superAdminDashboardService.get(params);
        setDashboard(data.data.dashboard);
        setLastUpdated(new Date());
      } catch (error) {
        if (!silent) toast.error(getErrorMessage(error, 'Unable to load dashboard'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [period, customRange, dateFrom, dateTo]
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Real-time silent refresh
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

  const chartData = dashboard?.charts || {};
  const kpis = dashboard?.kpis || {};
  const moneyStats = dashboard?.money || {};
  const affiliates = dashboard?.affiliates || {};
  const invoices = dashboard?.invoices || {};
  const coupons = dashboard?.coupons || {};

  const paymentTotal = useMemo(
    () => (chartData.paymentStatus || []).reduce((sum, item) => sum + Number(item.value || 0), 0),
    [chartData.paymentStatus]
  );

  const rangeLabel = customRange
    ? `${dateFrom} → ${dateTo}`
    : PERIODS.find((item) => item.value === period)?.label || `${period} days`;

  if (loading && !dashboard) return <ContentLoader />;

  return (
    <div className="space-y-6 pb-8">
      <section className="relative overflow-hidden rounded-3xl bg-[#021A54] px-6 py-6 text-white shadow-[0_22px_45px_rgba(2,26,84,0.22)] sm:px-8 sm:py-7">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-cyan-400/10 blur-2xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-blue-200">
                Platform command center
              </p>
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
            <h1 className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl">
              {greeting()}, {firstName(fullName)}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-100/80">
              Revenue, customer health and operations—one clear view of what needs attention.
            </p>
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
                onClick={() => loadDashboard({ silent: true })}
                disabled={refreshing}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-50"
                aria-label="Refresh dashboard"
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Taxable revenue"
          value={money(kpis.revenue)}
          helper={`Across ${moneyStats.payments || 0} successful payments`}
          icon={IndianRupee}
          trend={kpis.revenueChange}
          href="/super-admin/revenue"
        />
        <KpiCard
          label="Monthly recurring revenue"
          value={money(kpis.mrr)}
          helper={`${number(kpis.payingClients)} active paying clients`}
          icon={TrendingUp}
          tone="blue"
          href="/super-admin/plans"
        />
        <KpiCard
          label="Active clients"
          value={number(kpis.activeClients)}
          helper={`${number(kpis.newClients)} new · ${number(kpis.totalClients)} total`}
          icon={Store}
          trend={kpis.clientGrowth}
          tone="emerald"
          href="/super-admin/clients"
        />
        <KpiCard
          label="Needs attention"
          value={number(kpis.pendingActions)}
          helper={`${number(kpis.atRiskClients)} plans expire within 14 days`}
          icon={AlertTriangle}
          tone="amber"
        />
      </div>

      <div className="grid gap-3 rounded-2xl border border-[#E8ECF2] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.04)] sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Collected (incl. tax)',
            value: money(moneyStats.collected),
            icon: WalletCards,
            color: 'text-blue-700 bg-blue-50',
          },
          {
            label: 'GST collected',
            value: money(moneyStats.tax),
            icon: BadgeIndianRupee,
            color: 'text-violet-700 bg-violet-50',
          },
          {
            label: 'Discounts given',
            value: money(moneyStats.discounts),
            icon: Gift,
            color: 'text-amber-700 bg-amber-50',
          },
          {
            label: 'Suspended clients',
            value: number(kpis.suspendedClients),
            icon: Users,
            color: 'text-red-700 bg-red-50',
          },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3 rounded-xl bg-[#FAFBFC] p-3">
            <span
              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.color}`}
            >
              <item.icon size={17} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold text-[#667085]">{item.label}</p>
              <p className="mt-0.5 truncate text-[16px] font-bold text-[#101828]">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
        <SectionCard
          title="Revenue performance"
          subtitle="Ex-GST business revenue versus total amount collected"
          action={
            <Link
              href="/super-admin/platform-invoice"
              className="inline-flex items-center gap-1 text-[12px] font-bold text-[#2563EB]"
            >
              Invoices <ArrowRight size={13} />
            </Link>
          }
        >
          <div className="h-[310px] px-2 pb-3 pt-5 sm:px-4">
            {(chartData.revenue || []).length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.revenue} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563EB" stopOpacity={0.32} />
                      <stop offset="100%" stopColor="#2563EB" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#EEF1F5" strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={28}
                    tick={{ fill: '#98A2B3', fontSize: 11 }}
                  />
                  <YAxis
                    tickFormatter={(value) => money(value, true)}
                    axisLine={false}
                    tickLine={false}
                    width={58}
                    tick={{ fill: '#98A2B3', fontSize: 11 }}
                  />
                  <Tooltip content={<ChartTooltip moneyValues />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    fill="url(#revenueFill)"
                  />
                  <Area
                    type="monotone"
                    dataKey="collected"
                    name="Collected"
                    stroke="#14B8A6"
                    strokeWidth={2}
                    fill="transparent"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart text="Revenue data will appear after the first payment." />
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Client growth"
          subtitle="New shops joining during this period"
          action={
            <Link
              href="/super-admin/clients"
              className="inline-flex items-center gap-1 text-[12px] font-bold text-[#2563EB]"
            >
              Clients <ArrowRight size={13} />
            </Link>
          }
        >
          <div className="h-[310px] px-2 pb-3 pt-5 sm:px-4">
            {(chartData.clients || []).length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.clients} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#EEF1F5" strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={25}
                    tick={{ fill: '#98A2B3', fontSize: 11 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#98A2B3', fontSize: 11 }}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="clients" name="New clients" fill="#021A54" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart text="Client growth data will appear here." />
            )}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Plan mix" subtitle="Active clients by subscription plan">
          <div className="grid min-h-[280px] items-center gap-2 p-4 sm:grid-cols-[1fr_1fr]">
            {chartData.planMix?.length ? (
              <>
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData.planMix}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={58}
                        outerRadius={92}
                        paddingAngle={3}
                      >
                        {chartData.planMix.map((entry, index) => (
                          <Cell
                            key={entry.name}
                            fill={PLAN_COLORS[index % PLAN_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [number(value), 'Clients']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  {chartData.planMix.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: PLAN_COLORS[index % PLAN_COLORS.length] }}
                        />
                        <span className="truncate text-[12px] font-semibold text-[#475467]">
                          {item.name}
                        </span>
                      </div>
                      <span className="text-[12px] font-bold text-[#101828]">
                        {number(item.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="sm:col-span-2">
                <EmptyChart text="No active plans assigned yet." />
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Payment health" subtitle="Checkout outcomes for the selected period">
          <div className="grid min-h-[280px] items-center gap-4 p-5 sm:grid-cols-[1.25fr_1fr]">
            <div className="h-[230px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData.paymentStatus || []}
                  layout="vertical"
                  margin={{ top: 4, right: 12, left: 8, bottom: 4 }}
                >
                  <CartesianGrid stroke="#EEF1F5" strokeDasharray="4 4" horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#98A2B3', fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    width={55}
                    tick={{ fill: '#667085', fontSize: 11, textTransform: 'capitalize' }}
                  />
                  <Tooltip formatter={(value) => [number(value), 'Checkouts']} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {(chartData.paymentStatus || []).map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={PAYMENT_COLORS[entry.name] || '#98A2B3'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-2xl bg-[#F8FAFC] p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#98A2B3]">
                Conversion
              </p>
              <p className="mt-2 text-3xl font-bold text-[#101828]">
                {paymentTotal
                  ? `${Math.round(
                      (((chartData.paymentStatus || []).find((item) => item.name === 'paid')?.value ||
                        0) /
                        paymentTotal) *
                        100
                    )}%`
                  : '0%'}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-[#667085]">
                Paid checkouts as a share of all checkout attempts.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <SectionCard
          title="Coupon performance"
          subtitle={`${number(coupons.active)} active discount codes`}
          action={
            <Link
              href="/super-admin/discounts"
              className="inline-flex items-center gap-1 text-[12px] font-bold text-[#2563EB]"
            >
              Manage <ArrowRight size={13} />
            </Link>
          }
        >
          {coupons.top?.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-[12px]">
                <thead className="bg-[#FAFBFC] font-semibold uppercase tracking-wide text-[#98A2B3]">
                  <tr>
                    <th className="px-5 py-3">Code</th>
                    <th className="px-5 py-3">Uses</th>
                    <th className="px-5 py-3">Discount</th>
                    <th className="px-5 py-3 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.top.map((coupon) => (
                    <tr key={coupon.code} className="border-t border-[#F0F2F5]">
                      <td className="px-5 py-3.5">
                        <span className="rounded-lg bg-[#EEF3FF] px-2 py-1 font-bold text-[#1649AF]">
                          {coupon.code}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-[#475467]">
                        {number(coupon.uses)}
                      </td>
                      <td className="px-5 py-3.5 text-[#667085]">{money(coupon.discount)}</td>
                      <td className="px-5 py-3.5 text-right font-bold text-[#101828]">
                        {money(coupon.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-5">
              <EmptyChart text="No coupon-attributed payments in this period." />
            </div>
          )}
        </SectionCard>

        <SectionCard title="Operations" subtitle="Queues and billing hygiene">
          <div className="space-y-3 p-5">
            {[
              {
                label: 'Pending affiliates',
                value: affiliates.pending,
                helper: `${number(affiliates.active)} active partners`,
                icon: UserPlus,
                color: 'bg-violet-50 text-violet-700',
                href: '/super-admin/affiliates/pending',
              },
              {
                label: 'Invoices not emailed',
                value: invoices.notEmailed,
                helper: `${number(invoices.emailed)} of ${number(invoices.issued)} sent`,
                icon: FileWarning,
                color: 'bg-amber-50 text-amber-700',
                href: '/super-admin/platform-invoice',
              },
              {
                label: 'Plans ending soon',
                value: kpis.atRiskClients,
                helper: 'Within the next 14 days',
                icon: Clock3,
                color: 'bg-red-50 text-red-700',
                href: '/super-admin/clients',
              },
              {
                label: 'Affiliate payouts',
                value: money(affiliates.redeemed),
                helper: 'Total redeemed to date',
                icon: CircleDollarSign,
                color: 'bg-emerald-50 text-emerald-700',
                href: '/super-admin/affiliates',
              },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="group flex items-center gap-3 rounded-xl border border-[#EEF1F5] p-3 transition hover:border-[#C9D4EB] hover:bg-[#FAFBFF]"
              >
                <span
                  className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.color}`}
                >
                  <item.icon size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-[#667085]">{item.label}</p>
                  <p className="mt-0.5 truncate text-[11px] text-[#98A2B3]">{item.helper}</p>
                </div>
                <span className="text-[17px] font-bold text-[#101828]">{item.value}</span>
                <ArrowRight
                  size={14}
                  className="text-[#C1C7D0] transition group-hover:translate-x-0.5 group-hover:text-[#2563EB]"
                />
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Recent activity"
        subtitle="Latest client registrations and checkout events"
        action={
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#98A2B3]">
            <Activity size={13} /> Live overview
          </span>
        }
      >
        {dashboard?.recentActivity?.length ? (
          <div className="divide-y divide-[#F0F2F5]">
            {dashboard.recentActivity.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center"
              >
                <span
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    item.type === 'payment'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-blue-50 text-blue-700'
                  }`}
                >
                  {item.type === 'payment' ? <IndianRupee size={16} /> : <Store size={16} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[#101828]">{item.title}</p>
                  <p className="mt-0.5 truncate text-[11px] text-[#667085]">{item.description}</p>
                </div>
                {item.amount != null ? (
                  <p className="text-[13px] font-bold text-[#101828]">{money(item.amount)}</p>
                ) : null}
                <StatusPill status={item.status} />
                <span className="inline-flex min-w-[72px] items-center justify-end gap-1 text-[11px] text-[#98A2B3]">
                  <CalendarDays size={12} />
                  {timeAgo(item.at)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5">
            <EmptyChart text="No recent platform activity." />
          </div>
        )}
      </SectionCard>
    </div>
  );
}
