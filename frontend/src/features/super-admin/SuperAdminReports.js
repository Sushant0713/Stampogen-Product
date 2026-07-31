'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  Handshake,
  IndianRupee,
  Store,
  UserPlus,
  Users,
} from 'lucide-react';
import {
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
import { ContentLoader } from '@/components/loaders/Spinner';
import {
  AnalyticsHero,
  ChartTooltip,
  EmptyChart,
  KpiCard,
  money,
  number,
  PLAN_COLORS,
  SectionCard,
  shortDate,
  StatusPill,
  timeAgo,
  useSuperAdminAnalytics,
} from '@/features/super-admin/analyticsShared';

export function SuperAdminReports() {
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
  } = useSuperAdminAnalytics({ errorMessage: 'Unable to load reports' });

  const chartData = dashboard?.charts || {};
  const kpis = dashboard?.kpis || {};
  const affiliates = dashboard?.affiliates || {};
  const invoices = dashboard?.invoices || {};
  const coupons = dashboard?.coupons || {};
  const recentActivity = dashboard?.recentActivity || [];

  const planTotal = useMemo(
    () => (chartData.planMix || []).reduce((sum, item) => sum + Number(item.value || 0), 0),
    [chartData.planMix]
  );

  const invoiceChart = useMemo(
    () => [
      { name: 'Emailed', value: Number(invoices.emailed) || 0, color: '#16A34A' },
      { name: 'Not emailed', value: Number(invoices.notEmailed) || 0, color: '#F59E0B' },
    ],
    [invoices.emailed, invoices.notEmailed]
  );

  const invoiceIssued = Number(invoices.issued) || 0;

  if (loading && !dashboard) return <ContentLoader />;

  return (
    <div className="space-y-6 pb-8">
      <AnalyticsHero
        eyebrow="Insights"
        title="Reports"
        description="Client growth, plan mix, affiliate health and invoice delivery for the selected range."
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
          label="Active clients"
          value={number(kpis.activeClients)}
          helper={`${number(kpis.newClients)} new · ${number(kpis.totalClients)} total`}
          icon={Store}
          trend={kpis.clientGrowth}
          href="/super-admin/clients"
        />
        <KpiCard
          label="Needs attention"
          value={number(kpis.pendingActions)}
          helper={`${number(kpis.atRiskClients)} plans expire within 14 days`}
          icon={AlertTriangle}
          tone="amber"
        />
        <KpiCard
          label="Affiliates"
          value={number(affiliates.active)}
          helper={`${number(affiliates.pending)} pending · ${number(affiliates.total)} total`}
          icon={Handshake}
          tone="blue"
          href="/super-admin/affiliates"
        />
        <KpiCard
          label="Invoices issued"
          value={number(invoices.issued)}
          helper={`${number(invoices.notEmailed)} not emailed yet`}
          icon={FileText}
          tone="violet"
          href="/super-admin/platform-invoice"
        />
      </div>

      <div className="grid gap-3 rounded-2xl border border-[#E8ECF2] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.04)] sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'New clients',
            value: number(kpis.newClients),
            icon: UserPlus,
            color: 'text-emerald-700 bg-emerald-50',
          },
          {
            label: 'Suspended',
            value: number(kpis.suspendedClients),
            icon: Users,
            color: 'text-red-700 bg-red-50',
          },
          {
            label: 'At-risk plans',
            value: number(kpis.atRiskClients),
            icon: AlertTriangle,
            color: 'text-amber-700 bg-amber-50',
          },
          {
            label: 'Affiliate redeemed',
            value: money(affiliates.redeemed),
            icon: IndianRupee,
            color: 'text-blue-700 bg-blue-50',
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

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
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
              <EmptyChart text="Client growth data will appear here." heightClass="h-[310px]" />
            )}
          </div>
        </SectionCard>

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
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="space-y-2">
                  {chartData.planMix.map((item, index) => {
                    const share = planTotal
                      ? Math.round((Number(item.value) / planTotal) * 100)
                      : 0;
                    return (
                      <li key={item.name} className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: PLAN_COLORS[index % PLAN_COLORS.length] }}
                          />
                          <span className="truncate text-[12px] font-semibold text-[#344054]">
                            {item.name}
                          </span>
                        </div>
                        <span className="shrink-0 text-[12px] font-bold text-[#101828]">
                          {number(item.value)} · {share}%
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <EmptyChart text="No active plan mix yet." />
            )}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard title="Invoice delivery" subtitle="Platform invoices in this snapshot">
          <div className="p-5">
            {invoiceIssued ? (
              <div className="space-y-4">
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={invoiceChart}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={4}
                      >
                        {invoiceChart.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {invoiceChart.map((item) => (
                    <div key={item.name} className="rounded-xl bg-[#FAFBFC] px-3 py-2">
                      <p className="text-[11px] font-semibold text-[#667085]">{item.name}</p>
                      <p className="mt-0.5 text-[15px] font-bold text-[#101828]">
                        {number(item.value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyChart text="No invoices issued yet." heightClass="h-[220px]" />
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Affiliate health"
          subtitle="Partner pipeline and payouts"
          action={
            <Link
              href="/super-admin/affiliates/pending"
              className="inline-flex items-center gap-1 text-[12px] font-bold text-[#2563EB]"
            >
              Pending <ArrowRight size={13} />
            </Link>
          }
        >
          <div className="space-y-3 p-5">
            {[
              { label: 'Total partners', value: number(affiliates.total) },
              { label: 'Active', value: number(affiliates.active) },
              { label: 'Pending approval', value: number(affiliates.pending) },
              { label: 'Redeemed to date', value: money(affiliates.redeemed) },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-xl bg-[#FAFBFC] px-4 py-3"
              >
                <span className="text-[13px] font-semibold text-[#667085]">{row.label}</span>
                <span className="text-[15px] font-bold text-[#101828]">{row.value}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Top coupons"
          subtitle="Highest attributed revenue"
          action={
            <Link
              href="/super-admin/discounts"
              className="inline-flex items-center gap-1 text-[12px] font-bold text-[#2563EB]"
            >
              All <ArrowRight size={13} />
            </Link>
          }
        >
          {coupons.top?.length ? (
            <ul className="divide-y divide-[#F0F2F5]">
              {coupons.top.slice(0, 6).map((coupon) => (
                <li key={coupon.code} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-[#021A54]">{coupon.code}</p>
                    <p className="text-[11px] font-medium text-[#98A2B3]">
                      {number(coupon.uses)} uses · {money(coupon.discount)} off
                    </p>
                  </div>
                  <p className="shrink-0 text-[13px] font-bold text-[#101828]">
                    {money(coupon.revenue)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyChart text="No coupon activity in this range." heightClass="h-[220px]" />
          )}
        </SectionCard>
      </div>

      <SectionCard title="Recent activity" subtitle="Payments and new clients from the live feed">
        {recentActivity.length ? (
          <ul className="divide-y divide-[#F0F2F5]">
            {recentActivity.map((item) => (
              <li key={`${item.type}-${item.id}`} className="flex items-start gap-3 px-5 py-3.5">
                <span
                  className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    item.type === 'payment'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-[#EAF0FF] text-[#021A54]'
                  }`}
                >
                  {item.type === 'payment' ? <IndianRupee size={16} /> : <Store size={16} />}
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
                  <p className="shrink-0 text-[13px] font-bold text-[#101828]">{money(item.amount)}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyChart text="No recent activity yet." />
        )}
      </SectionCard>
    </div>
  );
}
