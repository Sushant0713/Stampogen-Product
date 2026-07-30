'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
  Search,
  Smartphone,
  Wallet,
  XCircle,
} from 'lucide-react';
import { affiliateEarningsService } from '@/services/affiliateEarnings.service';
import { getErrorMessage } from '@/utils';

const ACCENT = '#021A54';
const PAGE_SIZE = 15;

function formatMoney(value) {
  const n = Number(value) || 0;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function methodLabel(method) {
  if (method === 'both') return 'Bank + UPI';
  if (method === 'upi') return 'UPI';
  if (method === 'bank') return 'Bank';
  return '—';
}

function statusBadge(status) {
  if (status === 'paid') {
    return {
      label: 'Paid',
      className: 'bg-[#ECFDF5] text-[#065F46]',
    };
  }
  if (status === 'rejected') {
    return {
      label: 'Rejected',
      className: 'bg-[#FEF3F2] text-[#B42318]',
    };
  }
  return {
    label: 'Pending',
    className: 'bg-[#FFFBEB] text-[#92400E]',
  };
}

export function AffiliateRedeemList() {
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selected, setSelected] = useState(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  const load = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent) setLoading(true);
        const { data } = await affiliateEarningsService.adminListRedeems({
          page,
          limit: PAGE_SIZE,
          status: status || undefined,
          search: search || undefined,
        });
        setRows(data?.data?.redeems || []);
        const pagination = data?.data?.pagination || {};
        setTotalPages(pagination.totalPages || 1);
        setTotal(pagination.total || 0);
      } catch (error) {
        if (!silent) toast.error(getErrorMessage(error, 'Unable to load redeem requests'));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [page, status, search]
  );

  useEffect(() => {
    load();
  }, [load]);

  const copyText = async (label, value) => {
    const text = String(value || '').trim();
    if (!text) {
      toast.error(`No ${label} to copy`);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Unable to copy ${label}`);
    }
  };

  const handleMarkPaid = async () => {
    if (!selected?.id || acting) return;
    try {
      setActing(true);
      const { data } = await affiliateEarningsService.adminMarkPaid(selected.id);
      const next = data?.data?.redeem;
      toast.success(data?.message || 'Marked as paid. Email sent to affiliate.');
      if (next) setSelected(next);
      await load({ silent: true });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to mark as paid'));
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!selected?.id || acting) return;
    const note = String(rejectNote || '').trim();
    if (!note) {
      toast.error('Please enter a rejection reason');
      return;
    }
    try {
      setActing(true);
      const { data } = await affiliateEarningsService.adminReject(selected.id, { note });
      const next = data?.data?.redeem;
      toast.success(data?.message || 'Rejected. Email sent to affiliate.');
      setRejectOpen(false);
      setRejectNote('');
      if (next) setSelected(next);
      await load({ silent: true });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to reject redeem'));
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-[#021A54]">
            Affiliate Redeem
          </h1>
          <p className="mt-1 text-sm text-[#667085]">
            Review redeem requests, mark Paid or Reject, and notify the affiliate by email.
          </p>
        </div>
        <p className="text-sm font-medium text-[#344054]">{total} request{total === 1 ? '' : 's'}</p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-4 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]"
          />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1);
                setSearch(searchInput.trim());
              }
            }}
            placeholder="Search name, email, account, UPI, IFSC…"
            className="h-10 w-full rounded-lg border border-[#D0D5DD] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#021A54] focus:ring-1 focus:ring-[#021A54]"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          className="h-10 rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm outline-none focus:border-[#021A54]"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
        </select>
        <button
          type="button"
          onClick={() => {
            setPage(1);
            setSearch(searchInput.trim());
          }}
          className="h-10 rounded-lg px-4 text-sm font-semibold text-white"
          style={{ backgroundColor: ACCENT }}
        >
          Search
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[#667085]">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading redeem requests…
          </div>
        ) : rows.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-[#667085]">
            No redeem requests yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#F2F4F7] bg-[#F9FAFB] text-[12px] uppercase tracking-wide text-[#667085]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Affiliate</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Method</th>
                  <th className="px-4 py-3 font-semibold">Payout details</th>
                  <th className="px-4 py-3 font-semibold">Requested</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F4F7]">
                {rows.map((row) => {
                  const payout = row.payout || {};
                  const hasBank = Boolean(payout.accountNumber || payout.ifsc);
                  const hasUpi = Boolean(payout.upiId);
                  const badge = statusBadge(row.status);
                  return (
                    <tr key={row.id} className="align-top hover:bg-[#FCFCFD]">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#101828]">
                          {row.affiliate?.name || '—'}
                        </p>
                        <p className="text-[12px] text-[#667085]">{row.affiliate?.email || '—'}</p>
                        {row.discountCode ? (
                          <p className="mt-0.5 font-mono text-[11px] text-[#021A54]">
                            {row.discountCode}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#021A54]">
                        {formatMoney(row.amount)}
                      </td>
                      <td className="px-4 py-3 text-[#344054]">{methodLabel(row.payoutMethod)}</td>
                      <td className="px-4 py-3 text-[12px] text-[#475467]">
                        {hasBank ? (
                          <div className="space-y-0.5">
                            <p className="font-medium text-[#101828]">
                              {payout.accountHolderName || '—'}
                            </p>
                            <p className="font-mono">{payout.accountNumber || '—'}</p>
                            <p>
                              {payout.ifsc || '—'}
                              {payout.bankName ? ` · ${payout.bankName}` : ''}
                            </p>
                          </div>
                        ) : null}
                        {hasUpi ? (
                          <p className={`${hasBank ? 'mt-1.5' : ''} font-mono text-[#021A54]`}>
                            UPI: {payout.upiId}
                          </p>
                        ) : null}
                        {!hasBank && !hasUpi ? <span className="text-[#98A2B3]">—</span> : null}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#667085]">
                        {formatDateTime(row.redeemedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelected(row);
                              setRejectOpen(false);
                              setRejectNote('');
                            }}
                            className="text-[13px] font-semibold text-[#2E90FA] hover:underline"
                          >
                            View
                          </button>
                          {row.status === 'pending' ? (
                            <>
                              <button
                                type="button"
                                disabled={acting}
                                onClick={async () => {
                                  if (
                                    !window.confirm(
                                      `Mark ${formatMoney(row.amount)} as paid for ${
                                        row.affiliate?.name || 'this affiliate'
                                      }? An email will be sent.`
                                    )
                                  ) {
                                    return;
                                  }
                                  try {
                                    setActing(true);
                                    const { data } = await affiliateEarningsService.adminMarkPaid(
                                      row.id
                                    );
                                    toast.success(
                                      data?.message || 'Marked as paid. Email sent to affiliate.'
                                    );
                                    await load({ silent: true });
                                  } catch (error) {
                                    toast.error(getErrorMessage(error, 'Unable to mark as paid'));
                                  } finally {
                                    setActing(false);
                                  }
                                }}
                                className="rounded-lg bg-[#065F46] px-2.5 py-1 text-[12px] font-semibold text-white disabled:opacity-50"
                              >
                                Paid
                              </button>
                              <button
                                type="button"
                                disabled={acting}
                                onClick={() => {
                                  setSelected(row);
                                  setRejectNote('');
                                  setRejectOpen(true);
                                }}
                                className="rounded-lg border border-[#FDA29B] bg-[#FEF3F2] px-2.5 py-1 text-[12px] font-semibold text-[#B42318] disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-[#F2F4F7] px-4 py-3">
            <p className="text-[12px] text-[#667085]">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium disabled:opacity-40"
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium disabled:opacity-40"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[#101828]">Redeem request</h3>
                <p className="mt-1 text-sm text-[#667085]">
                  {formatDateTime(selected.redeemedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setRejectOpen(false);
                  setRejectNote('');
                }}
                className="rounded-lg px-2 py-1 text-sm font-medium text-[#667085] hover:bg-[#F2F4F7]"
              >
                Close
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-[#EAECF0] bg-[#F9FAFB] p-4">
                <div className="flex items-center gap-2 text-[#021A54]">
                  <Wallet size={16} />
                  <p className="text-[12px] font-semibold uppercase tracking-wide">Amount</p>
                </div>
                <p className="mt-2 text-2xl font-semibold text-[#021A54]">
                  {formatMoney(selected.amount)}
                </p>
                <p className="mt-1 text-[12px] text-[#667085]">
                  Status: {statusBadge(selected.status).label} · Method:{' '}
                  {methodLabel(selected.payoutMethod)}
                </p>
                {selected.decisionNote ? (
                  <p className="mt-2 text-[13px] text-[#475467]">
                    Note: {selected.decisionNote}
                  </p>
                ) : null}
              </div>

              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#667085]">
                  Affiliate
                </p>
                <p className="mt-1 font-semibold text-[#101828]">
                  {selected.affiliate?.name || '—'}
                </p>
                <p className="text-sm text-[#475467]">{selected.affiliate?.email || '—'}</p>
                {selected.affiliate?.phone ? (
                  <p className="text-sm text-[#475467]">{selected.affiliate.phone}</p>
                ) : null}
                {selected.discountCode ? (
                  <p className="mt-1 font-mono text-[12px] text-[#021A54]">
                    Code {selected.discountCode}
                  </p>
                ) : null}
              </div>

              {selected.payout?.accountNumber || selected.payout?.ifsc ? (
                <div className="rounded-xl border border-[#E5E7EB] p-4">
                  <div className="mb-3 flex items-center gap-2 text-[#021A54]">
                    <Building2 size={16} />
                    <p className="text-[12px] font-semibold uppercase tracking-wide">
                      Bank details
                    </p>
                  </div>
                  <dl className="space-y-2 text-sm">
                    {[
                      ['Holder', selected.payout.accountHolderName],
                      ['Account', selected.payout.accountNumber],
                      ['IFSC', selected.payout.ifsc],
                      ['Bank', selected.payout.bankName],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-start justify-between gap-3">
                        <div>
                          <dt className="text-[11px] text-[#98A2B3]">{label}</dt>
                          <dd className="font-medium text-[#101828]">{value || '—'}</dd>
                        </div>
                        {value ? (
                          <button
                            type="button"
                            onClick={() => copyText(label, value)}
                            className="rounded-md p-1.5 text-[#667085] hover:bg-[#F2F4F7]"
                            aria-label={`Copy ${label}`}
                          >
                            <Copy size={14} />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}

              {selected.payout?.upiId ? (
                <div className="rounded-xl border border-[#E5E7EB] p-4">
                  <div className="mb-3 flex items-center gap-2 text-[#021A54]">
                    <Smartphone size={16} />
                    <p className="text-[12px] font-semibold uppercase tracking-wide">UPI</p>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-sm font-semibold text-[#101828]">
                      {selected.payout.upiId}
                    </p>
                    <button
                      type="button"
                      onClick={() => copyText('UPI ID', selected.payout.upiId)}
                      className="rounded-md p-1.5 text-[#667085] hover:bg-[#F2F4F7]"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              ) : null}

              {selected.status === 'pending' ? (
                <div className="space-y-3 border-t border-[#F2F4F7] pt-4">
                  {rejectOpen ? (
                    <div className="space-y-3 rounded-xl border border-[#FDA29B] bg-[#FEF3F2] p-4">
                      <p className="text-sm font-semibold text-[#B42318]">Reject redeem request</p>
                      <textarea
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        rows={3}
                        placeholder="Reason for rejection (required — emailed to affiliate)"
                        className="w-full rounded-lg border border-[#FDA29B] bg-white px-3 py-2 text-sm outline-none focus:border-[#B42318] focus:ring-1 focus:ring-[#B42318]"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={acting}
                          onClick={() => {
                            setRejectOpen(false);
                            setRejectNote('');
                          }}
                          className="h-10 rounded-lg border border-[#D0D5DD] bg-white px-4 text-sm font-semibold text-[#344054]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={acting}
                          onClick={handleReject}
                          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#B42318] px-4 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          {acting ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}
                          Confirm reject
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        disabled={acting}
                        onClick={() => {
                          setRejectOpen(true);
                          setRejectNote('');
                        }}
                        className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#FDA29B] bg-[#FEF3F2] px-4 text-sm font-semibold text-[#B42318] disabled:opacity-50"
                      >
                        <XCircle size={15} />
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={acting}
                        onClick={handleMarkPaid}
                        className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#065F46] px-4 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {acting ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={15} />
                        )}
                        Mark paid
                      </button>
                    </div>
                  )}
                  <p className="text-[12px] text-[#667085]">
                    Affiliate receives an email on Paid or Reject. Reject returns the amount to
                    their current earnings balance.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
