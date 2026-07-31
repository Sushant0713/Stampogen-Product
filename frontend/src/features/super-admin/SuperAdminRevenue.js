'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import {
  ArrowRight,
  BadgeIndianRupee,
  CircleDollarSign,
  Gift,
  IndianRupee,
  Percent,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ContentLoader } from '@/components/loaders/Spinner';
import {
  AnalyticsHero,
  ChartTooltip,
  EmptyChart,
  KpiCard,
  money,
  number,
  PAYMENT_COLORS,
  SectionCard,
  shortDate,
  StatusPill,
  timeAgo,
  useSuperAdminAnalytics,
} from '@/features/super-admin/analyticsShared';

export function SuperAdminRevenue() {
  const {
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
  } = useSuperAdminAnalytics({ errorMessage: 'Unable to load revenue' });

  const chartData = dashboard?.charts || {};
  const kpis = dashboard?.kpis || {};
  const moneyStats = dashboard?.money || {};
  const coupons = dashboard?.coupons || {};

  const paymentEvents = useMemo(
    () => (dashboard?.recentActivity || []).filter((item) => item.type === 'payment'),
    [dashboard?.recentActivity]
  );

  const paymentTotal = useMemo(
    () => (chartData.paymentStatus || []).reduce((sum, item) => sum + Number(item.value || 0), 0),
    [chartData.paymentStatus]
  );

  const avgTicket = useMemo(() => {
    const payments = Number(moneyStats.payments) || 0;
    if (!payments) return 0;
    return (Number(kpis.revenue) || 0) / payments;
  }, [kpis.revenue, moneyStats.payments]);

  const discountRate = useMemo(() => {
    const revenue = Number(kpis.revenue) || 0;
    const discounts = Number(moneyStats.discounts) || 0;
    const base = revenue + discounts;
    if (!base) return 0;
    return Math.round((discounts / base) * 1000) / 10;
  }, [kpis.revenue, moneyStats.discounts]);

  if (loading && !dashboard) return <ContentLoader />;

  return (
    <div className="space-y-6 pb-8">
      <AnalyticsHero
        eyebrow="Finance"
        title="Revenue"
        description="Live taxable revenue, collections, GST and coupon impact for the selected range."
        rangeLabel={rangeLabel}
        lastUpdated={lastUpdated}
        live={live}
        setLive={setLive}
        period={period}
        customRange={customRange}
        dateFrom={dateFrom}
        dateTo={dateTo}
        applyPreset={applyPreset}
        applyCustomDates={applyCustomDates}
        onRefresh={() => loadDashboard({ silent: true })}
        refreshing={refreshing}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Taxable revenue"
          value={money(kpis.revenue)}
          helper={`${number(moneyStats.payments || 0)} successful payments`}
          icon={IndianRupee}
          trend={kpis.revenueChange}
        />
        <KpiCard
          label="Collected (incl. tax)"
          value={money(moneyStats.collected)}
          helper={`GST ${money(moneyStats.tax)}`}
          icon={WalletCards}
          tone="blue"
          href="/super-admin/platform-invoice"
        />
        <KpiCard
          label="Monthly recurring"
          value={money(kpis.mrr)}
          helper={`${number(kpis.payingClients)} paying clients`}
          icon={TrendingUp}
          tone="emerald"
          href="/super-admin/plans"
        />
        <KpiCard
          label="Avg ticket size"
          value={money(avgTicket)}
          helper={`${discountRate}% discount rate`}
          icon={CircleDollarSign}
          tone="amber"
        />
      </div>

      <div className="grid gap-3 rounded-2xl border border-[#E8ECF2] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.04)] sm:grid-cols-2 lg:grid-cols-4">
        {[
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
            label: 'Active coupons',
            value: number(coupons.active || 0),
            icon: Percent,
            color: 'text-blue-700 bg-blue-50',
          },
          {
            label: 'Paying clients',
            value: number(kpis.payingClients || 0),
            icon: TrendingUp,
            color: 'text-emerald-700 bg-emerald-50',
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

      <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        <SectionCard
          title="Revenue vs collected"
          subtitle="Ex-GST taxable revenue against total amount collected"
          action={
            <Link
              href="/super-admin/platform-invoice"
              className="inline-flex items-center gap-1 text-[12px] font-bold text-[#2563EB]"
            >
              Invoices <ArrowRight size={13} />
            </Link>
          }
        >
          <div className="h-[320px] px-2 pb-3 pt-5 sm:px-4">
            {(chartData.revenue || []).length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.revenue} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revPageFill" x1="0" y1="0" x2="0" y2="1">
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
                    fill="url(#revPageFill)"
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
              <EmptyChart text="Revenue data will appear after the first payment." heightClass="h-[320px]" />
            )}
          </div>
        </SectionCard>

        <SectionCard title="Checkout outcomes" subtitle="Payment status mix for this range">
          <div className="space-y-4 p-5">
            {(chartData.paymentStatus || []).length ? (
              <>
                <div className="h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData.paymentStatus}
                      layout="vertical"
                      margin={{ top: 4, right: 12, left: 8, bottom: 4 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={64}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#667085', fontSize: 12, fontWeight: 600 }}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="value" name="Count" radius={[0, 6, 6, 0]} barSize={18}>
                        {chartData.paymentStatus.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={PAYMENT_COLORS[entry.name] || '#94A3B8'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {chartData.paymentStatus.map((item) => {
                    const share = paymentTotal
                      ? Math.round((Number(item.value) / paymentTotal) * 100)
                      : 0;
                    return (
                      <div key={item.name} className="rounded-xl bg-[#FAFBFC] px-3 py-2">
                        <p className="text-[11px] font-semibold capitalize text-[#667085]">
                          {item.name}
                        </p>
                        <p className="mt-0.5 text-[15px] font-bold text-[#101828]">
                          {number(item.value)}{' '}
                          <span className="text-[11px] font-semibold text-[#98A2B3]">{share}%</span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <EmptyChart text="No checkout activity in this range." />
            )}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard
          title="Coupon impact"
          subtitle="Top codes by attributed taxable revenue"
          action={
            <Link
              href="/super-admin/discounts"
              className="inline-flex items-center gap-1 text-[12px] font-bold text-[#2563EB]"
            >
              Discounts <ArrowRight size={13} />
            </Link>
          }
        >
          {coupons.top?.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#FAFBFC] text-[11px] uppercase tracking-wider text-[#98A2B3]">
                  <tr>
                    <th className="px-5 py-3 font-bold">Code</th>
                    <th className="px-5 py-3 font-bold">Uses</th>
                    <th className="px-5 py-3 font-bold">Discount</th>
                    <th className="px-5 py-3 font-bold">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.top.map((coupon) => (
                    <tr key={coupon.code} className="border-t border-[#F0F2F5]">
                      <td className="px-5 py-3 font-bold text-[#021A54]">{coupon.code}</td>
                      <td className="px-5 py-3 text-[#344054]">{number(coupon.uses)}</td>
                      <td className="px-5 py-3 text-[#344054]">{money(coupon.discount)}</td>
                      <td className="px-5 py-3 font-semibold text-[#101828]">
                        {money(coupon.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyChart text="No coupon-attributed payments in this period." />
          )}
        </SectionCard>

        <SectionCard
          title="Recent payments"
          subtitle="Latest successful checkouts from the live feed"
          action={
            <Link
              href="/super-admin/clients"
              className="inline-flex items-center gap-1 text-[12px] font-bold text-[#2563EB]"
            >
              Clients <ArrowRight size={13} />
            </Link>
          }
        >
          {paymentEvents.length ? (
            <ul className="divide-y divide-[#F0F2F5]">
              {paymentEvents.map((item) => (
                <li key={item.id} className="flex items-start gap-3 px-5 py-3.5">
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <IndianRupee size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[13px] font-bold text-[#101828]">{item.title}</p>
                      <StatusPill status={item.status} />
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-[#667085]">{item.description}</p>
                    <p className="mt-1 text-[11px] font-medium text-[#98A2B3]">{timeAgo(item.at)}</p>
                  </div>
                  {item.amount != null ? (
                    <p className="shrink-0 text-[13px] font-bold text-[#101828]">
                      {money(item.amount)}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyChart text="No recent payments to show." />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
