'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminPageHeader } from '@/features/admin/AdminPageShell';
import { adminCardClass } from '@/features/admin/adminTheme';
import { loyaltyService } from '@/services/loyalty.service';
import { outletService } from '@/services/outlet.service';
import { useAuth } from '@/contexts/AuthContext';
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
  outletScope: 'all',
  outletTenantIds: [],
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
  const outletScope = form.outletScope === 'selected' ? 'selected' : 'all';
  const outletTenantIds =
    outletScope === 'selected'
      ? (form.outletTenantIds || []).map(String).filter(Boolean)
      : [];

  return {
    title,
    stampsRequired,
    minOrderValue,
    maxCustomers: maxCustomers || null,
    startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
    validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : null,
    outletScope,
    outletTenantIds,
  };
}

function outletScopeLabel(offer, outletsById) {
  if ((offer.outletScope || 'all') !== 'selected') return 'All outlets';
  const ids = (offer.outletTenantIds || []).map(String);
  if (!ids.length) return 'Selected outlets';
  const names = ids
    .map((id) => outletsById.get(id)?.name)
    .filter(Boolean);
  if (!names.length) return `${ids.length} outlet${ids.length === 1 ? '' : 's'}`;
  if (names.length <= 2) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
}

export function AdminOffers() {
  const { user } = useAuth();
  const isOutlet = Boolean(user?.isOutlet || user?.tenant?.kind === 'outlet');
  const [offers, setOffers] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [busyKey, setBusyKey] = useState('');

  const outletsById = useMemo(() => {
    const map = new Map();
    outlets.forEach((o) => map.set(String(o.id), o));
    return map;
  }, [outlets]);

  const load = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const [{ data }, outletsRes] = await Promise.all([
        loyaltyService.adminListOffers(),
        isOutlet ? Promise.resolve(null) : outletService.dashboard().catch(() => null),
      ]);
      setOffers(data.data.offers || []);
      setOutlets(outletsRes?.data?.data?.outlets || []);
    } catch (error) {
      if (!silent) toast.error(getErrorMessage(error, 'Unable to load offers'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [isOutlet]);

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
    if (isOutlet) return;
    setEditingKey(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (offer) => {
    if (isOutlet) return;
    setEditingKey(offer.key);
    setForm({
      title: offer.title || '',
      stampsRequired: offer.stampsRequired || 5,
      startDate: toDateInput(offer.startDate),
      validUntil: toDateInput(offer.validUntil),
      minOrderValue: offer.minOrderValue || 0,
      maxCustomers:
        offer.maxCustomers == null ? '' : String(offer.maxCustomers),
      outletScope: offer.outletScope === 'selected' ? 'selected' : 'all',
      outletTenantIds: (offer.outletTenantIds || []).map(String),
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (busy) return;
    setModalOpen(false);
    setEditingKey(null);
    setForm(EMPTY_FORM);
  };

  const toggleOutlet = (outletId) => {
    const id = String(outletId);
    setForm((f) => {
      const set = new Set((f.outletTenantIds || []).map(String));
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...f, outletTenantIds: Array.from(set) };
    });
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
    if (
      form.outletScope === 'selected' &&
      !(form.outletTenantIds || []).length
    ) {
      toast.error('Select at least one outlet');
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
    if (isOutlet) return;
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
      <AdminPageHeader
        title="Offers"
        subtitle={
          isOutlet
            ? 'Offers from your main shop — view only. Changes are made by the shop Admin.'
            : 'Manage every loyalty card in one place.'
        }
      />

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
              {isOutlet
                ? 'No offers assigned to this outlet yet. Ask the shop Admin to add one.'
                : 'Tap + to create a loyalty offer customers can earn stamps toward.'}
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
                  {outlets.length > 0 ? (
                    <p className="mt-0.5 text-[11px] font-semibold text-[#64748B]">
                      Outlets: {outletScopeLabel(o, outletsById)}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-[11px] font-bold text-[#22C55E]">
                    {o.redemptions || 0} redemptions
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-[10.5px] font-bold',
                        active ? 'text-[#22C55E]' : 'text-[#94A3B8]'
                      )}
                    >
                      {busyKey === o.key ? '…' : active ? 'Active' : 'Paused'}
                    </span>
                    {!isOutlet ? (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={active}
                        aria-label={active ? 'Pause offer' : 'Activate offer'}
                        disabled={busyKey === o.key}
                        onClick={() => toggleStatus(o)}
                        className={cn(
                          'relative inline-flex h-7 w-[48px] shrink-0 items-center rounded-full transition-colors disabled:opacity-60',
                          active ? 'bg-[#22C55E]' : 'bg-[#CBD5E1]'
                        )}
                      >
                        <span
                          className={cn(
                            'absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform',
                            active ? 'translate-x-[20px]' : 'translate-x-0'
                          )}
                        />
                      </button>
                    ) : null}
                  </div>
                  {!isOutlet ? (
                    <button
                      type="button"
                      onClick={() => openEdit(o)}
                      className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-[#F8FAFC] text-[#021A54]"
                      aria-label="Edit offer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      {!isOutlet ? (
        <button
          type="button"
          onClick={openCreate}
          className="fixed bottom-24 right-5 z-30 flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#021A54,#3B82F6)] text-white shadow-[0_14px_28px_rgba(2,26,84,0.32)] lg:bottom-10 lg:right-10"
          aria-label="Add offer"
        >
          <Plus className="h-5 w-5" strokeWidth={2.6} />
        </button>
      ) : null}

      {modalOpen && !isOutlet ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="flex max-h-[min(92dvh,920px)] w-full max-w-md flex-col overflow-hidden rounded-t-[24px] bg-white shadow-[0_10px_26px_rgba(2,26,84,0.07)] sm:rounded-[24px]">
            <div className="flex shrink-0 items-center justify-between border-b border-[#F1F5F9] px-5 py-4">
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
            <form onSubmit={saveOffer} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#64748B]">Offer title</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Collect 6 Stamps & Enjoy FREE Fries."
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

              {outlets.length > 0 ? (
                <div className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#64748B]">
                    Apply to outlets
                  </span>
                  <div className="flex gap-2">
                    {[
                      { id: 'all', label: 'All outlets' },
                      { id: 'selected', label: 'Selected outlets' },
                    ].map((opt) => {
                      const selected = form.outletScope === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              outletScope: opt.id,
                              outletTenantIds:
                                opt.id === 'all' ? [] : f.outletTenantIds || [],
                            }))
                          }
                          className={cn(
                            'flex-1 rounded-xl px-3 py-2.5 text-[12.5px] font-bold transition',
                            selected
                              ? 'bg-[#021A54] text-white'
                              : 'border border-[#E2E8F0] bg-white text-[#64748B]'
                          )}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  {form.outletScope === 'selected' ? (
                    <div className="mt-3 max-h-40 space-y-2 overflow-y-auto rounded-xl border border-[#E2E8F0] p-2">
                      {outlets.map((outlet) => {
                        const checked = (form.outletTenantIds || [])
                          .map(String)
                          .includes(String(outlet.id));
                        return (
                          <label
                            key={outlet.id}
                            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[#F8FAFC]"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleOutlet(outlet.id)}
                              className="h-4 w-4 accent-[#021A54]"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-[#021A54]">
                                {outlet.name}
                              </span>
                              {outlet.ownerEmail ? (
                                <span className="block truncate text-[11px] text-[#94A3B8]">
                                  {outlet.ownerEmail}
                                </span>
                              ) : null}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-[#94A3B8]">
                      This offer will be available at every outlet under this shop.
                    </p>
                  )}
                </div>
              ) : null}
              </div>

              <div className="flex shrink-0 gap-2 border-t border-[#F1F5F9] bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
