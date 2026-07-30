'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Phone, Search, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminPageHeader } from '@/features/admin/AdminPageShell';
import { adminCardClass } from '@/features/admin/adminTheme';
import { loyaltyService } from '@/services/loyalty.service';
import { cn, getErrorMessage } from '@/utils';

function initialsOf(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function relativeJoined(date) {
  if (!date) return 'Joined recently';
  const then = new Date(date).getTime();
  if (Number.isNaN(then)) return 'Joined recently';
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days < 1) return 'Joined today';
  if (days === 1) return 'Joined yesterday';
  return `Joined ${days} days ago`;
}

function relativeVisit(date) {
  if (!date) return '—';
  const then = new Date(date).getTime();
  if (Number.isNaN(then)) return '—';
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatScanAt(date) {
  if (!date) return '';
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  return value.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState('');
  const [viewingId, setViewingId] = useState('');
  const [detail, setDetail] = useState(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const { data } = await loyaltyService.adminListCustomers();
      setCustomers(data.data.customers || []);
    } catch (error) {
      if (!silent) toast.error(getErrorMessage(error, 'Unable to load customers'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load({ silent: true }), 10000);
    return () => clearInterval(id);
  }, [load]);

  const closeDetail = () => {
    setDetail(null);
    setViewingId('');
  };

  const openDetail = async (customer) => {
    try {
      setViewingId(customer.id);
      const { data } = await loyaltyService.adminGetCustomer(customer.id);
      setDetail(data.data.customer);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to load customer details'));
      setViewingId('');
    }
  };

  const toggleStatus = async (customer) => {
    const next = customer.status === 'active' ? 'suspended' : 'active';
    try {
      setBusyId(customer.id);
      await loyaltyService.adminUpdateCustomer(customer.id, { status: next });
      toast.success(next === 'suspended' ? `${customer.name} suspended` : `${customer.name} activated`);
      await load({ silent: true });
      if (detail?.id === customer.id) {
        setDetail((prev) => (prev ? { ...prev, status: next } : prev));
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to update customer'));
    } finally {
      setBusyId('');
    }
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    const qPhone = q.replace(/[\s\-()]/g, '');
    return customers.filter((c) => {
      const name = String(c.name || '').toLowerCase();
      const phone = String(c.phone || '')
        .toLowerCase()
        .replace(/[\s\-()]/g, '');
      return name.includes(q) || (qPhone && phone.includes(qPhone));
    });
  }, [customers, search]);

  const removeCustomer = async (customer) => {
    const ok = window.confirm(
      `Remove ${customer.name} from your loyalty program? Their stamps and history for your shop will be deleted.`
    );
    if (!ok) return;
    try {
      setBusyId(customer.id);
      await loyaltyService.adminDeleteCustomer(customer.id);
      toast.success(`${customer.name} removed`);
      if (detail?.id === customer.id) closeDetail();
      await load({ silent: true });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to delete customer'));
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl pb-24 lg:max-w-none lg:pb-8">
      <AdminPageHeader
        title="Customers"
        subtitle="Everyone who has joined your loyalty program."
      />

      <label className="mb-3.5 flex items-center gap-2.5 rounded-[14px] bg-white px-3.5 py-3 shadow-[0_6px_16px_rgba(2,26,84,0.06)]">
        <Search size={16} className="shrink-0 text-[#94A3B8]" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone number"
          className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-[#021A54] outline-none placeholder:text-[#94A3B8]"
          aria-label="Search customers by name or phone"
        />
      </label>

      <div className={adminCardClass('overflow-hidden')}>
        {loading ? (
          <p className="px-4 py-10 text-center text-sm text-[#64748B]">Loading customers…</p>
        ) : customers.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-[#64748B]">
            No customers yet. Share your loyalty QR so people can join.
          </p>
        ) : visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-[#64748B]">
            No customers match “{search.trim()}”.
          </p>
        ) : (
          visible.map((c, i) => {
            const isActive = c.status !== 'suspended';
            return (
              <div
                key={c.id}
                className={cn(
                  'flex items-center justify-between gap-3 px-4 py-3.5',
                  i < visible.length - 1 ? 'border-b border-[#F1F5F9]' : '',
                  !isActive && 'bg-[#FAFAFA]'
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                      isActive
                        ? 'bg-[rgba(59,130,246,0.12)] text-[#021A54]'
                        : 'bg-[#E2E8F0] text-[#94A3B8]'
                    )}
                  >
                    {initialsOf(c.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-[#021A54]">{c.name}</p>
                      {!isActive ? (
                        <span className="shrink-0 rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-bold text-[#B45309]">
                          Suspended
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-[11px] text-[#94A3B8]">
                      {c.totalStamps}
                      {c.stampsRequired ? `/${c.stampsRequired}` : ''} stamps ·{' '}
                      {relativeJoined(c.joinedAt)}
                      {c.phone ? ` · ${c.phone}` : c.email ? ` · ${c.email}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    disabled={viewingId === c.id}
                    onClick={() => openDetail(c)}
                    className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#EEF4FF] text-[#021A54] disabled:opacity-60"
                    aria-label={`View ${c.name}`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => toggleStatus(c)}
                    className={cn(
                      'rounded-[10px] px-3 py-1.5 text-[10.5px] font-bold disabled:opacity-60',
                      isActive
                        ? 'bg-[rgba(148,163,184,0.15)] text-[#64748B]'
                        : 'bg-[rgba(34,197,94,0.12)] text-[#22C55E]'
                    )}
                  >
                    {isActive ? 'Suspend' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => removeCustomer(c)}
                    className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#FEF2F2] text-[#DC2626] disabled:opacity-60"
                    aria-label={`Delete ${c.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {detail || viewingId ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onClick={closeDetail}
          role="presentation"
        >
          <div
            className="flex max-h-[min(92dvh,720px)] w-full max-w-md flex-col overflow-hidden rounded-t-[24px] bg-white shadow-[0_20px_50px_rgba(2,26,84,0.2)] sm:rounded-[24px]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-detail-title"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#F1F5F9] px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[rgba(59,130,246,0.12)] text-sm font-bold text-[#021A54]">
                  {initialsOf(detail?.name || '')}
                </div>
                <div className="min-w-0">
                  <h3 id="customer-detail-title" className="truncate text-base font-extrabold text-[#021A54]">
                    {detail?.name || 'Loading…'}
                  </h3>
                  {detail?.phone ? (
                    <p className="mt-0.5 flex items-center gap-1 text-[12px] font-medium text-[#64748B]">
                      <Phone className="h-3 w-3" />
                      {detail.phone}
                    </p>
                  ) : detail?.email ? (
                    <p className="mt-0.5 truncate text-[12px] font-medium text-[#64748B]">{detail.email}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {detail ? (
                  <span className="text-[11px] font-extrabold uppercase tracking-wide text-[#021A54]">
                    {detail.totalStamps}
                    {detail.stampsRequired ? `/${detail.stampsRequired}` : ''} stamps
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={closeDetail}
                  className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F8FAFC]"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              {!detail ? (
                <p className="py-10 text-center text-sm text-[#64748B]">Loading details…</p>
              ) : (
                <>
                  <div className="space-y-3 rounded-2xl border border-[#F1F5F9] bg-[#F8FAFC] px-4 py-3">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-[#64748B]">Total Visits</span>
                      <span className="font-bold text-[#021A54]">{detail.totalVisits ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-[#64748B]">Last Visit</span>
                      <span className="font-bold text-[#021A54]">{relativeVisit(detail.lastVisit)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-[#64748B]">Status</span>
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                          detail.status === 'active'
                            ? 'bg-[#E2E8F0] text-[#334155]'
                            : 'bg-[#FEF3C7] text-[#B45309]'
                        )}
                      >
                        {detail.status === 'active' ? 'Active' : 'Suspended'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#94A3B8]">
                      Scan History
                    </p>
                    {(detail.scanHistory || []).length === 0 ? (
                      <p className="rounded-xl bg-[#F8FAFC] px-3 py-4 text-center text-[12px] text-[#94A3B8]">
                        No scans yet
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {detail.scanHistory.map((scan) => (
                          <div
                            key={`${scan.index}-${scan.at}`}
                            className="flex items-center justify-between gap-3 rounded-xl bg-[#F1F5F9] px-3 py-2.5"
                          >
                            <span className="text-[12px] font-bold text-[#021A54]">
                              #{scan.index} {formatScanAt(scan.at)}
                            </span>
                            <span className="truncate text-[11px] font-medium text-[#64748B]">
                              {scan.offerTitle}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-5">
                    <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#94A3B8]">
                      Offer History
                    </p>
                    <p className="mb-2 text-[11px] text-[#94A3B8]">
                      Redeemed offers from the last 2 months
                    </p>
                    {(detail.offerHistory || []).length === 0 ? (
                      <p className="rounded-xl bg-[#F8FAFC] px-3 py-4 text-center text-[12px] text-[#94A3B8]">
                        No redemptions yet
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {detail.offerHistory.map((entry, index) => (
                          <div
                            key={`${entry.offerKey || 'offer'}-${entry.at}-${index}`}
                            className="flex items-center justify-between gap-3 rounded-xl bg-[#EEF2FF] px-3 py-2.5"
                          >
                            <span className="truncate text-[12px] font-bold text-[#021A54]">
                              {entry.offerTitle || 'Offer'}
                            </span>
                            <span className="shrink-0 text-[11px] font-medium text-[#64748B]">
                              {formatScanAt(entry.at)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
