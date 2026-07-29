'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  IndianRupee,
  MailCheck,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import { platformInvoiceService } from '@/services/platformInvoice.service';
import { getErrorMessage } from '@/utils';

const PAGE_SIZE = 10;
const ACCENT = '#021A54';

const SOURCE_OPTIONS = [
  { value: '', label: 'All sources' },
  { value: 'payment', label: 'Checkout payment' },
  { value: 'plan_change', label: 'Plan change' },
];

const EMAIL_OPTIONS = [
  { value: '', label: 'All email status' },
  { value: 'true', label: 'Emailed' },
  { value: 'false', label: 'Not emailed' },
];

const filterInputClass =
  'h-10 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-[13px] text-[#101828] outline-none focus:border-[#021A54]';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatMoney(amount = 0, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    minimumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

function sourceLabel(source) {
  if (source === 'plan_change') return 'Plan change';
  return 'Checkout';
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-[#ECEFF3] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[13px] font-medium text-[#667085]">{label}</p>
          <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight text-[#101828]">
            {value}
          </p>
        </div>
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${ACCENT}18`, color: ACCENT }}
        >
          <Icon size={18} />
        </span>
      </div>
    </div>
  );
}

export function PlatformInvoiceList() {
  const [invoices, setInvoices] = useState([]);
  const [stats, setStats] = useState({
    totalInvoices: 0,
    emailed: 0,
    paymentSource: 0,
    planChangeSource: 0,
    revenue: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    pages: 1,
  });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [source, setSource] = useState('');
  const [planName, setPlanName] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [billing, setBilling] = useState('');
  const [emailed, setEmailed] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterOptions, setFilterOptions] = useState({
    plans: [],
    coupons: [],
    billings: [],
  });
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [actionId, setActionId] = useState(null);
  const [bulkRemoving, setBulkRemoving] = useState(false);
  const [viewingId, setViewingId] = useState(null);
  const [viewer, setViewer] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    return () => {
      if (viewer?.url) URL.revokeObjectURL(viewer.url);
    };
  }, [viewer]);

  const loadFilterOptions = useCallback(async ({ silent = false } = {}) => {
    try {
      const { data } = await platformInvoiceService.getFilterOptions();
      setFilterOptions({
        plans: data.data.options?.plans || [],
        coupons: data.data.options?.coupons || [],
        billings: data.data.options?.billings || [],
      });
    } catch (error) {
      if (!silent) toast.error(getErrorMessage(error, 'Unable to load filters'));
    }
  }, []);

  const loadStats = useCallback(async ({ silent = false } = {}) => {
    try {
      const { data } = await platformInvoiceService.getStats();
      setStats(data.data.stats || {});
    } catch (error) {
      if (!silent) toast.error(getErrorMessage(error, 'Unable to load invoice stats'));
    }
  }, []);

  const loadInvoices = useCallback(
    async (page = 1, { silent = false } = {}) => {
      try {
        if (!silent) setLoading(true);
        const { data } = await platformInvoiceService.getAll({
          page,
          limit: PAGE_SIZE,
          search: debouncedSearch || undefined,
          source: source || undefined,
          planName: planName || undefined,
          discountCode: discountCode || undefined,
          billing: billing || undefined,
          emailed: emailed || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        });
        const rows = data.data.invoices || [];
        setInvoices(rows);
        setPagination(data.data.pagination || { page: 1, limit: PAGE_SIZE, total: 0, pages: 1 });
        setSelectedIds((prev) =>
          prev.filter((id) => rows.some((row) => String(row._id) === String(id)))
        );
      } catch (error) {
        if (!silent) toast.error(getErrorMessage(error, 'Unable to load platform invoices'));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [debouncedSearch, source, planName, discountCode, billing, emailed, dateFrom, dateTo]
  );

  useEffect(() => {
    loadStats();
    loadFilterOptions({ silent: true });
  }, [loadStats, loadFilterOptions]);

  useEffect(() => {
    setSelectedIds([]);
    loadInvoices(1);
  }, [loadInvoices]);

  const activeFilterCount = useMemo(() => {
    return [
      debouncedSearch,
      source,
      planName,
      discountCode,
      billing,
      emailed,
      dateFrom,
      dateTo,
    ].filter(Boolean).length;
  }, [debouncedSearch, source, planName, discountCode, billing, emailed, dateFrom, dateTo]);

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setSource('');
    setPlanName('');
    setDiscountCode('');
    setBilling('');
    setEmailed('');
    setDateFrom('');
    setDateTo('');
  };

  const rangeLabel = useMemo(() => {
    if (!pagination.total) return '0 invoices';
    const start = (pagination.page - 1) * pagination.limit + 1;
    const end = Math.min(pagination.page * pagination.limit, pagination.total);
    return `${start}–${end} of ${pagination.total}`;
  }, [pagination]);

  const totalPages = Math.max(1, pagination.pages || 1);
  const pageIds = useMemo(
    () => invoices.map((row) => String(row._id)).filter(Boolean),
    [invoices]
  );
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const somePageSelected = pageIds.some((id) => selectedIds.includes(id));

  const toggleRow = (id) => {
    const key = String(id);
    setSelectedIds((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  const togglePage = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
      return;
    }
    setSelectedIds((prev) => [...new Set([...prev, ...pageIds])]);
  };

  const closeViewer = () => {
    setViewer((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
  };

  const handleView = async (invoice) => {
    const id = invoice?._id;
    if (!id) return;
    setViewingId(id);
    try {
      const { data } = await platformInvoiceService.getPdfBlob(id);
      const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/pdf' });
      if (blob.type && blob.type.includes('json')) {
        throw new Error('Unable to open invoice PDF');
      }
      const url = URL.createObjectURL(blob);
      setViewer({
        url,
        invoiceNumber: invoice.invoiceNumber,
        fileName: `${invoice.invoiceNumber || 'invoice'}.pdf`,
        client: invoice.shopName || invoice.clientName || '',
      });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to open invoice'));
    } finally {
      setViewingId(null);
    }
  };

  const handleDownload = () => {
    if (!viewer?.url) return;
    const link = document.createElement('a');
    link.href = viewer.url;
    link.download = viewer.fileName || 'invoice.pdf';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const refreshAfterDelete = async (removedCount) => {
    const shouldGoPrev =
      removedCount > 0 &&
      invoices.length <= removedCount &&
      pagination.page > 1;
    const nextPage = shouldGoPrev ? pagination.page - 1 : pagination.page;
    await Promise.all([
      loadInvoices(nextPage),
      loadStats({ silent: true }),
      loadFilterOptions({ silent: true }),
    ]);
  };

  const handleDelete = async (invoice) => {
    const id = invoice?._id;
    if (!id) return;
    const confirmed = window.confirm(
      `Remove invoice "${invoice.invoiceNumber}" from this list? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      setActionId(id);
      await platformInvoiceService.remove(id);
      setSelectedIds((prev) => prev.filter((item) => item !== String(id)));
      if (viewer?.invoiceNumber === invoice.invoiceNumber) closeViewer();
      toast.success('Invoice removed');
      await refreshAfterDelete(1);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to remove invoice'));
    } finally {
      setActionId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    const confirmed = window.confirm(
      `Remove ${selectedIds.length} selected invoice${selectedIds.length > 1 ? 's' : ''} from this list?`
    );
    if (!confirmed) return;

    try {
      setBulkRemoving(true);
      const result = await platformInvoiceService.removeMany(selectedIds);
      const deleted = Number(result?.data?.data?.deleted) || selectedIds.length;
      toast.success(
        `${deleted} invoice${deleted > 1 ? 's' : ''} removed`
      );
      setSelectedIds([]);
      closeViewer();
      await refreshAfterDelete(deleted);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to remove invoices'));
    } finally {
      setBulkRemoving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-title">Platform Invoice</h1>
          <p className="page-subtitle">
            Invoices issued to shop admins from checkout payments and plan changes.
          </p>
        </div>
        {selectedIds.length > 0 ? (
          <button
            type="button"
            disabled={bulkRemoving}
            onClick={handleBulkDelete}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#D92D20] px-4 text-[13px] font-semibold text-white transition hover:bg-[#B42318] disabled:opacity-50"
          >
            <Trash2 size={15} />
            {bulkRemoving ? 'Removing…' : `Remove selected (${selectedIds.length})`}
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total invoices" value={stats.totalInvoices || 0} icon={FileText} />
        <StatCard label="Emailed to clients" value={stats.emailed || 0} icon={MailCheck} />
        <StatCard label="Checkout invoices" value={stats.paymentSource || 0} icon={ShoppingBag} />
        <StatCard
          label="Invoice total"
          value={formatMoney(stats.revenue || 0)}
          icon={IndianRupee}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-[#ECEFF3] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="space-y-3 border-b border-[#F2F4F7] px-5 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[15px] font-semibold text-[#101828]">Invoice list</p>
              <p className="text-[13px] text-[#667085]">
                {rangeLabel}
                {selectedIds.length > 0 ? ` · ${selectedIds.length} selected` : ''}
                {activeFilterCount > 0 ? ` · ${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''}` : ''}
              </p>
            </div>
            {activeFilterCount > 0 ? (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-9 items-center rounded-lg border border-[#D0D5DD] px-3 text-[12px] font-semibold text-[#344054] hover:bg-[#F8FAFC]"
              >
                Clear filters
              </button>
            ) : null}
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <div className="relative md:col-span-2 xl:col-span-2">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoice, client, plan, coupon…"
                className="h-10 w-full rounded-lg border border-[#D0D5DD] bg-white pl-9 pr-3 text-[13px] text-[#101828] outline-none focus:border-[#021A54]"
              />
            </div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={filterInputClass}
              aria-label="From date"
            />
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              className={filterInputClass}
              aria-label="To date"
            />
            <select
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              className={filterInputClass}
              aria-label="Filter by plan"
            >
              <option value="">All plans</option>
              {filterOptions.plans.map((plan) => (
                <option key={plan} value={plan}>
                  {plan}
                </option>
              ))}
            </select>
            <select
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value)}
              className={filterInputClass}
              aria-label="Filter by coupon"
            >
              <option value="">All coupons</option>
              <option value="__NONE__">No coupon</option>
              {filterOptions.coupons.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
            <select
              value={billing}
              onChange={(e) => setBilling(e.target.value)}
              className={filterInputClass}
              aria-label="Filter by billing cycle"
            >
              <option value="">All billing</option>
              {filterOptions.billings.map((cycle) => (
                <option key={cycle} value={cycle}>
                  {cycle}
                </option>
              ))}
            </select>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className={filterInputClass}
              aria-label="Filter by source"
            >
              {SOURCE_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={emailed}
              onChange={(e) => setEmailed(e.target.value)}
              className={filterInputClass}
              aria-label="Filter by email status"
            >
              {EMAIL_OPTIONS.map((option) => (
                <option key={option.value || 'all-email'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[13px]">
            <thead className="bg-[#F9FAFB] text-[12px] font-semibold uppercase tracking-wide text-[#667085]">
              <tr>
                <th className="w-12 px-5 py-3">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = somePageSelected && !allPageSelected;
                    }}
                    onChange={togglePage}
                    aria-label="Select all invoices on this page"
                    className="h-4 w-4 rounded border-[#D0D5DD] text-[#021A54] focus:ring-[#021A54]"
                  />
                </th>
                <th className="px-5 py-3">Invoice</th>
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Issued</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-[#667085]">
                    Loading invoices…
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-[#667085]">
                    No platform invoices yet. Invoices appear here after clients are billed.
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => {
                  const id = String(invoice._id || '');
                  const isSelected = selectedIds.includes(id);
                  const busy =
                    viewingId === invoice._id ||
                    actionId === invoice._id ||
                    bulkRemoving;
                  return (
                    <tr
                      key={id || invoice.invoiceNumber}
                      className={`border-t border-[#F2F4F7] ${isSelected ? 'bg-[#F5F8FF]' : ''}`}
                    >
                      <td className="px-5 py-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(id)}
                          aria-label={`Select ${invoice.invoiceNumber}`}
                          className="h-4 w-4 rounded border-[#D0D5DD] text-[#021A54] focus:ring-[#021A54]"
                        />
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-[#101828]">{invoice.invoiceNumber}</p>
                        <p className="mt-0.5 text-[12px] text-[#98A2B3]">
                          {invoice.invoiceDate ? formatDate(invoice.invoiceDate) : '—'}
                          {invoice.dueDate ? ` · Due ${formatDate(invoice.dueDate)}` : ''}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-[#101828]">
                          {invoice.shopName || invoice.clientName || '—'}
                        </p>
                        <p className="mt-0.5 text-[12px] text-[#667085]">
                          {invoice.clientEmail || invoice.recipient || '—'}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-[#101828]">{invoice.planName || '—'}</p>
                        <p className="mt-0.5 text-[12px] text-[#667085]">
                          {invoice.billing || '—'}
                          {invoice.discountCode ? ` · ${invoice.discountCode}` : ''}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-full bg-[#F2F4F7] px-2.5 py-1 text-[11px] font-semibold text-[#344054]">
                          {sourceLabel(invoice.source)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-[#101828]">
                          {formatMoney(invoice.total, invoice.currency)}
                        </p>
                        <p className="mt-0.5 text-[12px] text-[#667085]">
                          Tax {formatMoney(invoice.taxAmount, invoice.currency)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        {invoice.emailed ? (
                          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                            Sent
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                            Not sent
                          </span>
                        )}
                        <p className="mt-1 max-w-[160px] truncate text-[12px] text-[#667085]">
                          {invoice.recipient || '—'}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-[#667085]">
                        {formatDate(invoice.issuedAt || invoice.createdAt)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={busy || !invoice._id}
                            onClick={() => handleView(invoice)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#D0D5DD] px-3 text-[12px] font-semibold text-[#021A54] hover:bg-[#F8FAFC] disabled:opacity-40"
                          >
                            <Eye size={14} />
                            {viewingId === invoice._id ? 'Opening…' : 'View'}
                          </button>
                          <button
                            type="button"
                            disabled={busy || !invoice._id}
                            onClick={() => handleDelete(invoice)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#D92D20] text-white transition hover:bg-[#B42318] disabled:opacity-40"
                            aria-label={`Remove ${invoice.invoiceNumber}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-[#F2F4F7] px-5 py-3">
          <p className="text-[13px] text-[#667085]">
            Page {pagination.page} of {totalPages} · {pagination.total} total
            {selectedIds.length > 0 ? ` · ${selectedIds.length} selected` : ''}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1 || loading}
              onClick={() => loadInvoices(pagination.page - 1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D0D5DD] text-[#344054] disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              disabled={pagination.page >= totalPages || loading}
              onClick={() => loadInvoices(pagination.page + 1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D0D5DD] text-[#344054] disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {viewer ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(2,26,84,0.55)] p-4 backdrop-blur-sm"
          onClick={closeViewer}
          role="presentation"
        >
          <div
            className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_30px_60px_rgba(0,0,0,0.35)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Invoice ${viewer.invoiceNumber}`}
          >
            <div className="flex items-center justify-between border-b border-[#E4E7EC] px-5 py-3">
              <div>
                <p className="text-[15px] font-semibold text-[#101828]">{viewer.invoiceNumber}</p>
                {viewer.client ? (
                  <p className="text-[12px] text-[#667085]">{viewer.client}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#D0D5DD] px-3 text-[12px] font-semibold text-[#021A54] hover:bg-[#F8FAFC]"
                >
                  <Download size={14} />
                  Download
                </button>
                <button
                  type="button"
                  onClick={closeViewer}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D0D5DD] text-[#344054] hover:bg-[#F8FAFC]"
                  aria-label="Close invoice viewer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <iframe title={viewer.invoiceNumber} src={viewer.url} className="h-full w-full bg-[#F2F4F7]" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
