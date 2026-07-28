'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminPageHeader } from '@/features/admin/AdminPageShell';
import { adminCardClass } from '@/features/admin/adminTheme';
import { loyaltyService } from '@/services/loyalty.service';
import { cn, getErrorMessage } from '@/utils';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'paused', label: 'Paused' },
];

const EMPTY_FORM = {
  title: '',
  stampsRequired: 5,
  startDate: '',
  validUntil: '',
  minOrderValue: 0,
  maxCustomers: '',
};

function toDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function buildPayload(form) {
  const title = form.title.trim();
  const stampsRequired = Math.min(100, Math.max(1, Number(form.stampsRequired) || 5));
  const minOrderValue = Math.max(0, Number(form.minOrderValue) || 0);
  const maxRaw = String(form.maxCustomers ?? '').trim();
  const maxCustomers = maxRaw === '' ? null : Math.max(1, Number(maxRaw) || 0);

  return {
    title,
    stampsRequired,
    minOrderValue,
    maxCustomers: maxCustomers || null,
    startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
    validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : null,
  };
}

export function AdminOffers() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [busyKey, setBusyKey] = useState('');

  const load = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const { data } = await loyaltyService.adminListOffers();
      setOffers(data.data.offers || []);
    } catch (error) {
      if (!silent) toast.error(getErrorMessage(error, 'Unable to load offers'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return offers.filter((o) => {
      if (filter !== 'all' && o.status !== filter) return false;
      if (!q) return true;
      return String(o.title || '').toLowerCase().includes(q);
    });
  }, [offers, filter, search]);

  const openCreate = () => {
    setEditingKey(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (offer) => {
    setEditingKey(offer.key);
    setForm({
      title: offer.title || '',
      stampsRequired: offer.stampsRequired || 5,
      startDate: toDateInput(offer.startDate),
      validUntil: toDateInput(offer.validUntil),
      minOrderValue: offer.minOrderValue || 0,
      maxCustomers:
        offer.maxCustomers == null ? '' : String(offer.maxCustomers),
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (busy) return;
    setModalOpen(false);
    setEditingKey(null);
    setForm(EMPTY_FORM);
  };

  const saveOffer = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Offer title is required');
      return;
    }
    if (form.startDate && form.validUntil && form.validUntil < form.startDate) {
      toast.error('Valid until must be on or after start date');
      return;
    }

    const payload = buildPayload(form);

    try {
      setBusy(true);
      if (editingKey) {
        await loyaltyService.adminUpdateOffer(editingKey, payload);
        toast.success('Offer updated');
      } else {
        await loyaltyService.adminCreateOffer(payload);
        toast.success('Offer added');
      }
      setModalOpen(false);
      setEditingKey(null);
      setForm(EMPTY_FORM);
      await load({ silent: true });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to save offer'));
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (offer) => {
    const next = offer.status === 'active' ? 'paused' : 'active';
    try {
      setBusyKey(offer.key);
      await loyaltyService.adminUpdateOffer(offer.key, { status: next });
      toast.success(next === 'active' ? 'Offer activated' : 'Offer paused');
      await load({ silent: true });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to update offer'));
    } finally {
      setBusyKey('');
    }
  };

  return (
    <div className="relative mx-auto w-full max-w-3xl pb-24 lg:max-w-none lg:pb-8">
      <AdminPageHeader title="Offers" subtitle="Manage every loyalty card in one place." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const selected = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                'rounded-xl px-4 py-2 text-[12.5px] font-bold transition',
                selected ? 'bg-[#021A54] text-white' : 'bg-white text-[#64748B] shadow-sm'
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className={cn(adminCardClass('mb-4 flex items-center gap-2 px-3 py-2.5'))}>
        <Search className="h-4 w-4 shrink-0 text-[#94A3B8]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search offers"
          className="w-full bg-transparent text-sm text-[#021A54] outline-none placeholder:text-[#94A3B8]"
        />
      </div>

      <div className="flex flex-col gap-3">
        {loading ? (
          <p className="py-10 text-center text-sm text-[#64748B]">Loading offers…</p>
        ) : visible.length === 0 ? (
          <div className={adminCardClass('px-4 py-10 text-center')}>
            <p className="text-sm font-semibold text-[#021A54]">No offers yet</p>
            <p className="mt-1 text-xs text-[#64748B]">
              Tap + to create a loyalty offer customers can earn stamps toward.
            </p>
          </div>
        ) : (
          visible.map((o) => {
            const active = o.status === 'active';
            return (
              <div key={o.key} className={adminCardClass('flex items-center gap-3 p-3.5')}>
                <div
                  className="h-11 w-11 shrink-0 rounded-xl"
                  style={{
                    background: `linear-gradient(135deg, ${o.color || '#3B82F6'}, #021A54)`,
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#021A54]">{o.title}</p>
                  <p className="text-[11.5px] font-semibold text-[#94A3B8]">
                    {o.stampsRequired} stamps · {o.dateLabel || 'No date limit'}
                  </p>
                  <p className="text-[11px] font-medium text-[#64748B]">
                    {o.minOrderLabel || 'No minimum order'} · Customers{' '}
                    {o.customerCount ?? 0}/{o.maxCustomersLabel || 'Unlimited'}
                  </p>
                  <p className="mt-0.5 text-[11px] font-bold text-[#22C55E]">
                    {o.redemptions || 0} redemptions
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    type="button"
                    disabled={busyKey === o.key}
                    onClick={() => toggleStatus(o)}
                    className={cn(
                      'rounded-[10px] px-3 py-1.5 text-[10.5px] font-bold',
                      active
                        ? 'bg-[rgba(34,197,94,0.12)] text-[#22C55E]'
                        : 'bg-[rgba(148,163,184,0.15)] text-[#64748B]'
                    )}
                  >
                    {active ? 'Active' : 'Paused'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(o)}
                    className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-[#F8FAFC] text-[#021A54]"
                    aria-label="Edit offer"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <button
        type="button"
        onClick={openCreate}
        className="fixed bottom-24 right-5 z-30 flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#021A54,#3B82F6)] text-white shadow-[0_14px_28px_rgba(2,26,84,0.32)] lg:bottom-10 lg:right-10"
        aria-label="Add offer"
      >
        <Plus className="h-5 w-5" strokeWidth={2.6} />
      </button>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className={cn(adminCardClass('max-h-[90vh] w-full max-w-md overflow-y-auto p-5'))}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-[#021A54]">
                {editingKey ? 'Edit offer' : 'Add offer'}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F8FAFC]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={saveOffer} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#64748B]">Offer title</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Buy 5 Get 1 Free"
                  maxLength={200}
                  className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm font-semibold text-[#021A54] outline-none focus:border-[#021A54]"
                  autoFocus
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#64748B]">
                  Stamps required
                </span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.stampsRequired}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, stampsRequired: e.target.value }))
                  }
                  className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm font-semibold text-[#021A54] outline-none focus:border-[#021A54]"
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#64748B]">
                    Start date (optional)
                  </span>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm font-semibold text-[#021A54] outline-none focus:border-[#021A54]"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#64748B]">
                    Valid until (optional)
                  </span>
                  <input
                    type="date"
                    value={form.validUntil}
                    onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
                    className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm font-semibold text-[#021A54] outline-none focus:border-[#021A54]"
                  />
                </label>
              </div>
              <p className="-mt-2 text-[11px] text-[#94A3B8]">
                Leave Valid until empty for no end date.
              </p>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#64748B]">
                  Minimum order value (₹)
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={form.minOrderValue}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, minOrderValue: e.target.value }))
                  }
                  className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm font-semibold text-[#021A54] outline-none focus:border-[#021A54]"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#64748B]">
                  Number of customers
                </span>
                <input
                  type="number"
                  min={1}
                  value={form.maxCustomers}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, maxCustomers: e.target.value }))
                  }
                  placeholder="Unlimited"
                  className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 text-sm font-semibold text-[#021A54] outline-none focus:border-[#021A54] placeholder:font-normal placeholder:text-[#94A3B8]"
                />
                <p className="mt-1 text-[11px] text-[#94A3B8]">
                  Leave empty for unlimited customers. When the limit is reached, the offer
                  pauses automatically.
                </p>
              </label>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 rounded-xl bg-[#F1F5F9] py-2.5 text-sm font-bold text-[#64748B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 rounded-xl bg-[#021A54] py-2.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {busy ? 'Saving…' : editingKey ? 'Save' : 'Add offer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
