'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Loader2, Store } from 'lucide-react';
import toast from 'react-hot-toast';
import { outletService } from '@/services/outlet.service';
import { getErrorMessage } from '@/utils';
import { AdminPageHeader } from '@/features/admin/AdminPageShell';
import { adminCardClass } from '@/features/admin/adminTheme';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function StatTile({ label, value, hint }) {
  return (
    <div className={adminCardClass('flex flex-col gap-1 p-3.5')}>
      <p className="text-[11px] font-semibold text-[#94A3B8]">{label}</p>
      <p className="text-xl font-extrabold text-[#021A54]">{value}</p>
      {hint ? <p className="text-[10px] font-medium text-[#CBD5E1]">{hint}</p> : null}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl bg-[#F8FAFC] px-3 py-2">
      <p className="text-[10px] font-semibold text-[#94A3B8]">{label}</p>
      <p className="text-sm font-extrabold text-[#021A54]">{value}</p>
    </div>
  );
}

export function AdminOutletsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data: res } = await outletService.dashboard();
      setData(res.data || null);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to load outlet reports'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-[#64748B]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading outlet reports…
      </div>
    );
  }

  const totals = data?.totals || {};
  const outlets = data?.outlets || [];

  return (
    <div className="space-y-5 pb-8">
      <AdminPageHeader
        title="Outlets Dashboard"
        subtitle="Reports across all your outlets — customers, stamps, rewards, and QR scans."
        actionHref="/admin/outlets"
        actionLabel="Manage outlets"
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <StatTile label="Outlets" value={totals.outlets || 0} hint={`${totals.activeOutlets || 0} active`} />
        <StatTile label="Customers" value={totals.totalCustomers || 0} hint="All outlets" />
        <StatTile label="Stamps given" value={totals.totalStamps || 0} />
        <StatTile label="Pending rewards" value={totals.pendingRewards || 0} />
        <StatTile label="Stamp requests" value={totals.pendingStampRequests || 0} />
        <StatTile label="Redeemed" value={totals.redeemedRewards || 0} />
        <StatTile label="Repeat customers" value={totals.repeatCustomers || 0} />
        <StatTile
          label="QR scans"
          value={totals.qrScansMonth || 0}
          hint="This month · all outlets"
        />
      </div>

      {totals.expiredOutlets > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {totals.expiredOutlets} outlet{totals.expiredOutlets === 1 ? '' : 's'} need a plan renew.
          <Link href="/admin/outlets" className="ml-2 font-bold underline">
            Review
          </Link>
        </div>
      ) : null}

      <div className={adminCardClass('overflow-hidden')}>
        <div className="flex items-center justify-between border-b border-[#F1F5F9] px-4 py-3">
          <div>
            <p className="text-sm font-extrabold text-[#021A54]">Outlet reports</p>
            <p className="text-[11px] font-medium text-[#94A3B8]">
              Per-outlet loyalty activity
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-[#021A54] hover:bg-[#F1F5F9]"
          >
            Refresh
          </button>
        </div>

        {!outlets.length ? (
          <div className="px-4 py-12 text-center">
            <Store className="mx-auto h-8 w-8 text-[#CBD5E1]" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-[#64748B]">No outlets yet</p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              Buy an outlet plan seat, then create an outlet login.
            </p>
            <Link
              href="/admin/outlets"
              className="mt-4 inline-flex rounded-xl bg-[#021A54] px-4 py-2.5 text-sm font-bold text-white"
            >
              Go to My outlets
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-[#F1F5F9]">
            {outlets.map((outlet) => (
              <li key={outlet.id} className="px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-extrabold text-[#021A54]">{outlet.name}</p>
                      {outlet.expired ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          Plan ended
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-[#94A3B8]">
                      {outlet.ownerEmail || '—'}
                      {outlet.planName ? ` · ${outlet.planName}` : ''}
                      {outlet.planEndsAt ? ` · ends ${formatDate(outlet.planEndsAt)}` : ''}
                    </p>
                  </div>
                  <Link
                    href="/admin/outlets"
                    className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#3B82F6]"
                  >
                    Manage
                    <ChevronRight size={14} />
                  </Link>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  <Metric label="Customers" value={outlet.stats?.totalCustomers || 0} />
                  <Metric label="Stamps" value={outlet.stats?.totalStamps || 0} />
                  <Metric label="Pending rewards" value={outlet.stats?.pendingRewards || 0} />
                  <Metric label="Stamp requests" value={outlet.stats?.pendingStampRequests || 0} />
                  <Metric label="Redeemed" value={outlet.stats?.redeemedRewards || 0} />
                  <Metric
                    label="QR this month"
                    value={outlet.stats?.qrScansMonth || 0}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
