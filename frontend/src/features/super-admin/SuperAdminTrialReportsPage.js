'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  BarChart3,
  CalendarRange,
  Filter,
  Gift,
  Loader2,
  Percent,
  RefreshCw,
  Search,
  Store,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { tenantService } from '@/services/tenant.service';
import { getErrorMessage } from '@/utils';

const PRIMARY = '#021A54';

const PERIODS = [
  { label: 'Today', value: 0 },
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
  { label: 'All time', value: 'all' },
];

const STATUS_OPTIONS = [
  { label: 'All statuses', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Expiring soon', value: 'expiring_soon' },
  { label: 'Expired', value: 'expired' },
  { label: 'Converted', value: 'converted' },
];

const ORIGIN_OPTIONS = [
  { label: 'All origins', value: 'all' },
  { label: 'Public signup', value: 'signup' },
  { label: 'Super Admin grant', value: 'admin' },
];

const SORTS = [
  { label: 'Ending soon', value: 'ending' },
  { label: 'Newest trial', value: 'newest' },
  { label: 'Oldest trial', value: 'oldest' },
  { label: 'Recently converted', value: 'converted' },
  { label: 'Shop A–Z', value: 'name' },
];

function toInputDate(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysAgoInputValue(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return toInputDate(d);
}

function formatShortDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatChartLabel(value) {
  if (!value) return '';
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function number(value) {
  return new Intl.NumberFormat().format(Number(value) || 0);
}

function statusBadge(status) {
  switch (status) {
    case 'active':
      return 'bg-emerald-50 text-emerald-700';
    case 'expiring_soon':
      return 'bg-amber-50 text-amber-800';
    case 'expired':
      return 'bg-red-50 text-red-700';
    case 'converted':
      return 'bg-sky-50 text-sky-800';
    default:
      return 'bg-[#F2F4F7] text-[#667085]';
  }
}

function statusLabel(status) {
  switch (status) {
    case 'active':
      return 'Active';
    case 'expiring_soon':
      return 'Expiring soon';
    case 'expired':
      return 'Expired';
    case 'converted':
      return 'Converted';
    default:
      return 'Inactive';
  }
}

const fieldClass =
  'h-10 w-full rounded-xl border border-[#E4E7EC] bg-white px-3 text-sm text-[#101828] outline-none transition focus:border-[#021A54] focus:ring-2 focus:ring-[#021A54]/15';

function Kpi({ label, value, helper, icon: Icon, truncate = false }) {
  return (
    <div className="rounded-2xl border border-[#E4E7EC] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#98A2B3]">{label}</p>
          <p
            className={`mt-2 text-2xl font-semibold tracking-tight text-[#101828] ${
              truncate ? 'truncate' : ''
            }`}
            title={truncate ? String(value) : undefined}
          >
            {value}
          </p>
          {helper ? <p className="mt-1 text-[12px] text-[#667085]">{helper}</p> : null}
        </div>
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${PRIMARY}12`, color: PRIMARY }}
        >
          <Icon size={16} />
        </span>
      </div>
    </div>
  );
}

export function SuperAdminTrialReportsPage() {
  const [period, setPeriod] = useState(30);
  const [customRange, setCustomRange] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => daysAgoInputValue(30));
  const [dateTo, setDateTo] = useState(() => toInputDate(new Date()));
  const [status, setStatus] = useState('all');
  const [origin, setOrigin] = useState('all');
  const [plan, setPlan] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('ending');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReports = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (silent) setRefreshing(true);
        else setLoading(true);

        const params = {
          sort,
          status: status !== 'all' ? status : undefined,
          origin: origin !== 'all' ? origin : undefined,
          plan: plan || undefined,
          search: search.trim() || undefined,
        };

        if (customRange) {
          params.from = dateFrom;
          params.to = dateTo;
        } else if (period !== 'all') {
          if (period === 0) {
            const today = toInputDate(new Date());
            params.from = today;
            params.to = today;
          } else {
            params.from = daysAgoInputValue(period);
            params.to = toInputDate(new Date());
          }
        }

        const { data } = await tenantService.trialReports(params);
        setReport(data?.data || null);
      } catch (error) {
        toast.error(getErrorMessage(error, 'Unable to load trial reports'));
        setReport(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [customRange, dateFrom, dateTo, origin, period, plan, search, sort, status]
  );

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const applyPreset = (value) => {
    setCustomRange(false);
    setPeriod(value);
    if (value === 'all') return;
    if (value === 0) {
      const today = toInputDate(new Date());
      setDateFrom(today);
      setDateTo(today);
      return;
    }
    setDateFrom(daysAgoInputValue(value));
    setDateTo(toInputDate(new Date()));
  };

  const summary = report?.summary || {};
  const items = report?.items || [];
  const series = report?.series || [];
  const plans = report?.plans || [];

  const rangeLabel = useMemo(() => {
    if (customRange) return `${dateFrom} → ${dateTo}`;
    if (period === 'all') return 'All time';
    return PERIODS.find((item) => item.value === period)?.label || 'Selected range';
  }, [customRange, dateFrom, dateTo, period]);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#98A2B3]">
            Trial analytics
          </p>
          <h1 className="mt-1 font-display text-[28px] font-semibold tracking-tight text-[#101828]">
            Free trial reports
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#667085]">
            Track which shops are on a free trial, who converted to paid, and trials started in the
            selected range.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/super-admin/settings/trial"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E4E7EC] bg-white px-4 text-sm font-semibold text-[#344054] transition hover:border-[#021A54]/25"
          >
            <Gift size={15} />
            Trial settings
          </Link>
          <Link
            href="/super-admin/clients"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E4E7EC] bg-white px-4 text-sm font-semibold text-[#344054] transition hover:border-[#021A54]/25"
          >
            <Store size={15} />
            Clients
          </Link>
          <button
            type="button"
            onClick={() => loadReports({ silent: true })}
            disabled={refreshing}
            className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
            style={{ backgroundColor: PRIMARY }}
          >
            {refreshing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            Refresh
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-[#E4E7EC] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#344054]">
          <Filter size={15} />
          Filters
          <span className="ml-auto text-[12px] font-medium text-[#98A2B3]">{rangeLabel}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {PERIODS.map((item) => (
            <button
              key={String(item.value)}
              type="button"
              onClick={() => applyPreset(item.value)}
              className={`h-9 rounded-full px-3.5 text-[12px] font-semibold transition ${
                !customRange && period === item.value
                  ? 'bg-[#021A54] text-white'
                  : 'bg-[#F2F4F7] text-[#344054] hover:bg-[#E4E7EC]'
              }`}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCustomRange(true)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-semibold transition ${
              customRange
                ? 'bg-[#021A54] text-white'
                : 'bg-[#F2F4F7] text-[#344054] hover:bg-[#E4E7EC]'
            }`}
          >
            <CalendarRange size={13} />
            Custom
          </button>
        </div>

        {customRange ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:max-w-md">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#667085]">From</label>
              <input
                type="date"
                className={fieldClass}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#667085]">To</label>
              <input
                type="date"
                className={fieldClass}
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-[#667085]">Status</label>
            <select
              className={fieldClass}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-[#667085]">Origin</label>
            <select
              className={fieldClass}
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
            >
              {ORIGIN_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-[#667085]">Plan</label>
            <select className={fieldClass} value={plan} onChange={(e) => setPlan(e.target.value)}>
              <option value="">All plans</option>
              {plans.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-[#667085]">Sort by</label>
            <select className={fieldClass} value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORTS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-[#667085]">Search</label>
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]"
              />
              <input
                className={`${fieldClass} pl-9`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Shop, owner, email"
              />
            </div>
          </div>
        </div>
      </section>

      {loading && !report ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-[#E4E7EC] bg-white py-20 text-sm text-[#667085]">
          <Loader2 size={16} className="animate-spin" />
          Loading trial reports…
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              label="Active trials"
              value={number(summary.active)}
              helper={`${number(summary.expiringSoon)} expiring within 7 days`}
              icon={Gift}
            />
            <Kpi
              label="Expired"
              value={number(summary.expired)}
              helper="Still on trial source, past end date"
              icon={CalendarRange}
            />
            <Kpi
              label="Converted"
              value={number(summary.converted)}
              helper={`${number(summary.conversionRate)}% of decided trials`}
              icon={Percent}
            />
            <Kpi
              label="Clients in view"
              value={number(summary.clients)}
              helper={`${number(summary.signupOrigin)} signup · ${number(summary.adminOrigin)} admin`}
              icon={Users}
            />
          </div>

          <section className="rounded-2xl border border-[#E4E7EC] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-5">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-[#101828]">Trials started over time</h2>
              <p className="mt-0.5 text-sm text-[#667085]">
                Daily count of free trials started for the selected filters.
              </p>
            </div>
            {series.length === 0 ? (
              <div className="flex h-56 items-center justify-center rounded-xl bg-[#F8FAFC] text-sm text-[#98A2B3]">
                No trial starts in this range yet.
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatChartLabel}
                      tick={{ fill: '#98A2B3', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={28}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: '#98A2B3', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: '#F2F4F7' }}
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid #E4E7EC',
                        boxShadow: '0 8px 20px rgba(16,24,40,0.08)',
                      }}
                      labelFormatter={(label) => formatShortDate(label)}
                      formatter={(value) => [number(value), 'Trials']}
                    />
                    <Bar dataKey="count" fill={PRIMARY} radius={[6, 6, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="border-b border-[#F2F4F7] px-4 py-4 sm:px-5">
              <div className="flex items-center gap-2">
                <BarChart3 size={16} className="text-[#021A54]" />
                <h2 className="text-base font-semibold text-[#101828]">Trial clients</h2>
              </div>
              <p className="mt-0.5 text-sm text-[#667085]">
                Shops on trial, expired without paying, or converted to a paid plan.
              </p>
            </div>

            {items.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm font-semibold text-[#344054]">No trial clients match these filters</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-[#667085]">
                  Grant a trial from Clients, or enable public signup trial under Free trial settings.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#F8FAFC] text-[11px] uppercase tracking-wide text-[#667085]">
                    <tr>
                      <th className="px-4 py-3 font-semibold sm:px-5">Client</th>
                      <th className="px-4 py-3 font-semibold">Plan</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Origin</th>
                      <th className="px-4 py-3 font-semibold">Started</th>
                      <th className="px-4 py-3 font-semibold">Ends</th>
                      <th className="px-4 py-3 font-semibold text-right">Days left</th>
                      <th className="px-4 py-3 font-semibold text-right">Ext.</th>
                      <th className="px-4 py-3 font-semibold">Converted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-t border-[#F2F4F7]">
                        <td className="px-4 py-3.5 sm:px-5">
                          <Link
                            href="/super-admin/clients"
                            className="font-semibold text-[#021A54] hover:underline"
                          >
                            {item.name}
                          </Link>
                          <div className="mt-0.5 text-[12px] text-[#667085]">
                            {item.owner?.name || '—'} · {item.owner?.email || '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-medium text-[#344054]">{item.planName}</td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${statusBadge(
                              item.trialStatus
                            )}`}
                          >
                            {statusLabel(item.trialStatus)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-[#344054]">
                          {item.origin === 'admin' ? 'Admin grant' : 'Signup'}
                        </td>
                        <td className="px-4 py-3.5 text-[#344054]">{formatShortDate(item.startedAt)}</td>
                        <td className="px-4 py-3.5 text-[#344054]">{formatShortDate(item.endsAt)}</td>
                        <td className="px-4 py-3.5 text-right font-semibold text-[#101828]">
                          {item.daysRemaining == null ? '—' : number(item.daysRemaining)}
                        </td>
                        <td className="px-4 py-3.5 text-right text-[#344054]">
                          {number(item.extendedCount)}
                        </td>
                        <td className="px-4 py-3.5 text-[#344054]">
                          {formatShortDate(item.convertedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
