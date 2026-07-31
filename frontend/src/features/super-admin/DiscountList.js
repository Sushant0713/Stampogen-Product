'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Ban,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Plus,
  Search,
  Tag,
  Ticket,
  Trash2,
  X,
} from 'lucide-react';
import { discountService } from '@/services/discount.service';
import { planService } from '@/services/plan.service';
import { getErrorMessage } from '@/utils';
import { notifyPricingPlansChanged } from '@/utils/pricingSync';

const PAGE_SIZE = 10;
const PRIMARY = '#021A54';
const ANY_PLAN = 'Any plan';

const EMPTY_FORM = {
  name: '',
  code: '',
  description: '',
  type: 'Simple discount',
  amountType: 'Percentage (%)',
  amountValue: '',
  specificPlan: ANY_PLAN,
  billingCycle: 'All billing cycles',
  minOrderAmount: '',
  maxUses: '',
  startDate: '',
  endDate: '',
  enabled: true,
};

const fieldClass =
  'h-11 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none placeholder:text-[#98A2B3] focus:border-primary focus:ring-1 focus:ring-primary';
const labelClass = 'mb-1.5 block text-[13px] font-semibold text-[#344054]';

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onChange();
      }}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition ${
        checked ? 'bg-primary' : 'bg-[#D0D5DD]'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-[#ECEFF3] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-center gap-3">
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${PRIMARY}14`, color: PRIMARY }}
        >
          <Icon size={16} />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#667085]">
            {label}
          </p>
          <p className="mt-0.5 text-[22px] font-semibold leading-none text-primary">{value}</p>
        </div>
      </div>
    </div>
  );
}

function lifecycleBadge(lifecycle) {
  const value = String(lifecycle || '').toLowerCase();
  if (value === 'active') return 'bg-emerald-50 text-emerald-700';
  if (value === 'scheduled') return 'bg-sky-50 text-sky-700';
  if (value === 'ended') return 'bg-gray-100 text-gray-600';
  if (value === 'disabled') return 'bg-red-50 text-red-700';
  return 'bg-amber-50 text-amber-700';
}

function formatDisplayDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function generatePromoCode() {
  const chunk = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SAVE${chunk}`;
}

function DetailItem({ label, children }) {
  return (
    <div className="rounded-xl border border-[#F2F4F7] bg-[#F9FAFB] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
        {label}
      </p>
      <div className="mt-2 text-sm font-medium text-[#101828]">{children}</div>
    </div>
  );
}

function DiscountViewPanel({ form, onClose }) {
  const startsLabel = form.startDate
    ? formatDisplayDate(form.startDate)
    : 'Immediately when enabled';
  const endsLabel = form.endDate ? formatDisplayDate(form.endDate) : 'No end date';
  const offerLabel =
    form.amountType === 'Flat (INR)'
      ? `Flat ₹${form.amountValue || '0'}`
      : `Percentage ${form.amountValue || '0'}%`;

  return (
    <section
      id="discount-form-panel"
      className="overflow-hidden rounded-xl border border-[#ECEFF3] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
    >
      <div className="flex items-start justify-between gap-3 border-b border-[#F2F4F7] bg-gradient-to-r from-primary to-[#01133F] px-5 py-5 text-white sm:px-6">
        <div className="min-w-0">
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-white/70">
            Discount details
          </p>
          <h2 className="mt-1 truncate text-xl font-semibold">{form.name || 'Untitled discount'}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold">
              {form.code || 'NO CODE'}
            </span>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-[12px] font-semibold ${
                form.enabled ? 'bg-emerald-400/20 text-emerald-100' : 'bg-white/10 text-white/80'
              }`}
            >
              {form.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close discount view"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/20"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div className="rounded-xl border border-[#EAECF0] bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
            Description
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[#344054]">
            {form.description || 'No description provided.'}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <DetailItem label="Type">{form.type}</DetailItem>
          <DetailItem label="Offer">{offerLabel}</DetailItem>
          <DetailItem label="Amount Type">{form.amountType}</DetailItem>
          <DetailItem label="Specific Plan">{form.specificPlan || ANY_PLAN}</DetailItem>
          <DetailItem label="Billing Cycle">{form.billingCycle}</DetailItem>
          <DetailItem label="Minimum Order">
            {form.minOrderAmount !== '' && form.minOrderAmount != null
              ? `₹${form.minOrderAmount}`
              : 'No minimum'}
          </DetailItem>
          <DetailItem label="Max Uses">
            {form.maxUses !== '' && form.maxUses != null ? form.maxUses : 'Unlimited'}
          </DetailItem>
          <DetailItem label="Status">
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                form.enabled
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {form.enabled ? 'Active for redemption' : 'Not available'}
            </span>
          </DetailItem>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[#D6E4FF] bg-[#F5F8FF] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-primary">
              Schedule
            </p>
            <p className="mt-2 text-sm text-[#344054]">
              <span className="font-semibold text-[#101828]">Starts:</span> {startsLabel}
            </p>
            <p className="mt-1 text-sm text-[#344054]">
              <span className="font-semibold text-[#101828]">Ends:</span> {endsLabel}
            </p>
          </div>
          <div className="rounded-xl border border-[#F5E6C8] bg-[#FFF9EB] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6B4F16]">
              Lifecycle preview
            </p>
            <p className="mt-2 text-sm text-[#7A5C1E]">
              This discount {form.enabled ? 'is currently available' : 'is currently disabled'} for
              redemption based on the schedule above.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-primary px-5 text-sm font-semibold text-primary transition hover:bg-primary-50"
          >
            Close
          </button>
        </div>
      </div>
    </section>
  );
}

function DiscountForm({ form, setForm, onClose, onSave, mode, saving = false, plans = [] }) {
  const isEdit = mode === 'edit';

  const startsLabel = form.startDate
    ? `Starts: ${formatDisplayDate(form.startDate)}`
    : 'Starts: Immediately when enabled';
  const endsLabel = form.endDate
    ? `Ends: ${formatDisplayDate(form.endDate)}`
    : 'Ends: No end date';

  const amountLabel =
    form.amountType === 'Flat (INR)' ? 'Flat Amount (INR)' : 'Percentage Value';

  const planOptions = useMemo(() => {
    const names = plans.map((plan) => plan.name).filter(Boolean);
    if (
      form.specificPlan &&
      form.specificPlan !== ANY_PLAN &&
      !names.includes(form.specificPlan)
    ) {
      return [form.specificPlan, ...names];
    }
    return names;
  }, [plans, form.specificPlan]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!form.name.trim()) {
      toast.error('Discount name is required');
      return;
    }
    if (!form.code.trim()) {
      toast.error('Promo code is required');
      return;
    }
    if (form.amountValue === '' || form.amountValue == null) {
      toast.error('Amount value is required');
      return;
    }
    const amount = Number(form.amountValue);
    if (Number.isNaN(amount) || amount < 0) {
      toast.error('Amount must be zero or greater');
      return;
    }
    if (form.amountType === 'Percentage (%)' && amount > 100) {
      toast.error('Percentage discount cannot exceed 100%');
      return;
    }
    if (form.minOrderAmount !== '' && Number(form.minOrderAmount) < 0) {
      toast.error('Minimum order amount must be zero or greater');
      return;
    }
    if (form.maxUses !== '' && Number(form.maxUses) < 0) {
      toast.error('Max uses must be zero or greater');
      return;
    }
    if (
      form.type === 'One Time Discount' &&
      (form.maxUses === '' || form.maxUses == null || Number(form.maxUses) < 1)
    ) {
      toast.error('One Time Discount requires Max users (e.g. 10)');
      return;
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      toast.error('End date must be on or after start date');
      return;
    }
    await onSave(form);
  };

  return (
    <section
      id="discount-form-panel"
      className="rounded-xl border border-[#ECEFF3] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6"
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#101828]">
            {isEdit ? 'Edit Discount' : 'New Discount'}
          </h2>
          <p className="mt-1 text-sm text-[#667085]">
            Configure promo details, schedule, and redemption limits.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close discount form"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D0D5DD] text-[#667085] transition hover:bg-[#F9FAFB] hover:text-primary"
        >
          <X size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
          <div>
            <label className={labelClass} htmlFor="discount-name">
              Discount Name
            </label>
            <input
              id="discount-name"
              className={fieldClass}
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
              placeholder="Enter discount name"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="promo-code">
              Promo Code
            </label>
            <div className="flex gap-2">
              <input
                id="promo-code"
                className={fieldClass}
                value={form.code}
                onChange={(event) => update('code', event.target.value.toUpperCase())}
                placeholder="PROMO CODE"
              />
              <button
                type="button"
                onClick={() => update('code', generatePromoCode())}
                className="h-11 shrink-0 rounded-lg border border-primary px-4 text-sm font-semibold text-primary transition hover:bg-primary-50"
              >
                Generate
              </button>
            </div>
          </div>

          <div className="lg:col-span-2">
            <label className={labelClass} htmlFor="discount-description">
              Description
            </label>
            <input
              id="discount-description"
              className={fieldClass}
              value={form.description}
              onChange={(event) => update('description', event.target.value)}
              placeholder="Short description for this discount"
            />
          </div>

          <div className="min-w-0">
            <label className={labelClass} htmlFor="discount-type">
              Type
            </label>
            <select
              id="discount-type"
              className={fieldClass}
              value={form.type}
              onChange={(event) => update('type', event.target.value)}
            >
              <option>Simple discount</option>
              <option>Partner discount</option>
              <option>One Time Discount</option>
            </select>
            {form.type === 'One Time Discount' ? (
              <p className="mt-1.5 max-w-full text-[12px] leading-relaxed text-[#667085] break-words">
                First purchase only. Set Max uses (e.g. 10) — users after that limit cannot redeem
                it.
              </p>
            ) : null}
          </div>

          <div>
            <label className={labelClass} htmlFor="amount-type">
              Amount Type
            </label>
            <select
              id="amount-type"
              className={fieldClass}
              value={form.amountType}
              onChange={(event) => update('amountType', event.target.value)}
            >
              <option>Percentage (%)</option>
              <option>Flat (INR)</option>
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="amount-value">
              {amountLabel}
            </label>
            <input
              id="amount-value"
              type="number"
              min="0"
              className={fieldClass}
              value={form.amountValue}
              onChange={(event) => update('amountValue', event.target.value)}
              placeholder={form.amountType === 'Flat (INR)' ? '1000' : '10'}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="specific-plan">
              Specific Plan (optional)
            </label>
            <select
              id="specific-plan"
              className={fieldClass}
              value={form.specificPlan || ANY_PLAN}
              onChange={(event) => update('specificPlan', event.target.value)}
            >
              <option value={ANY_PLAN}>{ANY_PLAN}</option>
              {planOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {plans.length === 0 ? (
              <p className="mt-1 text-[11px] text-[#98A2B3]">
                No plans found. Create plans first to restrict this discount.
              </p>
            ) : null}
          </div>

          <div>
            <label className={labelClass} htmlFor="billing-cycle">
              Billing Cycle
            </label>
            <select
              id="billing-cycle"
              className={fieldClass}
              value={form.billingCycle}
              onChange={(event) => update('billingCycle', event.target.value)}
            >
              <option>All billing cycles</option>
              <option>Monthly</option>
              <option>Yearly</option>
              <option>Custom</option>
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="min-order">
              Minimum Order Amount (INR)
            </label>
            <input
              id="min-order"
              type="number"
              min="0"
              className={fieldClass}
              value={form.minOrderAmount}
              onChange={(event) => update('minOrderAmount', event.target.value)}
              placeholder="0"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="max-uses">
              {form.type === 'One Time Discount' ? 'Max users (required)' : 'Max Uses'}
            </label>
            <input
              id="max-uses"
              type="number"
              min={form.type === 'One Time Discount' ? '1' : '0'}
              className={fieldClass}
              value={form.maxUses}
              onChange={(event) => update('maxUses', event.target.value)}
              placeholder={
                form.type === 'One Time Discount'
                  ? 'e.g. 10'
                  : 'Leave empty for unlimited'
              }
              required={form.type === 'One Time Discount'}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="start-date">
              Start Date
            </label>
            <input
              id="start-date"
              type="date"
              className={fieldClass}
              value={form.startDate}
              onChange={(event) => update('startDate', event.target.value)}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="end-date">
              End Date
            </label>
            <input
              id="end-date"
              type="date"
              className={fieldClass}
              value={form.endDate}
              onChange={(event) => update('endDate', event.target.value)}
            />
          </div>
        </div>

        <div className="rounded-lg border border-[#F5E6C8] bg-[#FFF9EB] px-4 py-3 text-sm text-[#7A5C1E]">
          <p className="font-semibold text-[#6B4F16]">Lifecycle preview</p>
          <p className="mt-1">{startsLabel}</p>
          <p>{endsLabel}</p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[#344054]">Enabled</span>
            <Toggle
              checked={form.enabled}
              label="Enable discount"
              onChange={() => update('enabled', !form.enabled)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold text-white transition hover:bg-[#01133F] disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: PRIMARY }}
            >
              {saving
                ? 'Saving...'
                : isEdit
                  ? 'Update Discount'
                  : 'Save Discount'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-primary px-5 text-sm font-semibold text-primary transition hover:bg-primary-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

export function DiscountList() {
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    scheduled: 0,
    ended: 0,
    disabled: 0,
    redeemed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [plans, setPlans] = useState([]);

  const loadDiscounts = useCallback(async () => {
    try {
      setLoading(true);
      const [{ data: listRes }, { data: statsRes }, { data: plansRes }] = await Promise.all([
        discountService.getAll({ limit: 200 }),
        discountService.getStats(),
        planService.getAll({ limit: 200 }),
      ]);
      setRows(listRes.data.discounts || []);
      setPlans(plansRes.data.plans || []);
      setStats(
        statsRes.data.stats || {
          total: 0,
          active: 0,
          scheduled: 0,
          ended: 0,
          disabled: 0,
          redeemed: 0,
        }
      );
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to load discounts'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDiscounts();
  }, [loadDiscounts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch =
        !q ||
        [row.name, row.code, row.description, row.type, row.offer]
          .join(' ')
          .toLowerCase()
          .includes(q);
      const matchesStatus = !status || row.lifecycle.toLowerCase() === status;
      const matchesType = !type || row.type.toLowerCase() === type;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [rows, search, status, type]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);
  const pageIds = pageRows.map((row) => row.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const somePageSelected = pageIds.some((id) => selectedIds.includes(id));
  const rangeLabel = filtered.length
    ? `${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} of ${filtered.length}`
    : '0 items';

  const fillFormFromRow = (row) => {
    setEditingId(row.id);
    setForm({
      name: row.name || '',
      code: row.code || '',
      description: row.description === '—' ? '' : row.description || '',
      type: row.type || 'Simple discount',
      amountType:
        row.amountType === 'flat' || String(row.offer || '').includes('flat')
          ? 'Flat (INR)'
          : 'Percentage (%)',
      amountValue:
        row.amountValue != null
          ? String(row.amountValue)
          : String(row.offer || '').replace(/[^\d.]/g, ''),
      specificPlan: row.specificPlan || ANY_PLAN,
      billingCycle: row.billingCycle || 'All billing cycles',
      minOrderAmount: row.minOrderAmount != null ? String(row.minOrderAmount) : '',
      maxUses: row.usageLimit != null ? String(row.usageLimit) : '',
      startDate: row.startDate || '',
      endDate: row.endDate || '',
      enabled: Boolean(row.enabled),
    });
  };

  const scrollToForm = () => {
    requestAnimationFrame(() => {
      document.getElementById('discount-form-panel')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const openCreateForm = () => {
    setFormMode('create');
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    scrollToForm();
  };

  const openEditForm = (row) => {
    setFormMode('edit');
    fillFormFromRow(row);
    setShowForm(true);
    scrollToForm();
  };

  const openViewForm = (row) => {
    setFormMode('view');
    fillFormFromRow(row);
    setShowForm(true);
    scrollToForm();
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async (values) => {
    const payload = {
      name: values.name.trim(),
      code: values.code.trim().toUpperCase(),
      description: values.description.trim(),
      type: values.type,
      amountType: values.amountType,
      amountValue: Number(values.amountValue) || 0,
      planType: 'All plan types',
      specificPlan: values.specificPlan || ANY_PLAN,
      billingCycle: values.billingCycle || 'All billing cycles',
      minOrderAmount:
        values.minOrderAmount === '' || values.minOrderAmount == null
          ? null
          : Number(values.minOrderAmount),
      maxUses:
        values.maxUses === '' || values.maxUses == null ? null : Number(values.maxUses),
      startDate: values.startDate || null,
      endDate: values.endDate || null,
      enabled: Boolean(values.enabled),
    };

    try {
      setSaving(true);
      if (formMode === 'edit' && editingId) {
        await discountService.update(editingId, payload);
        toast.success('Discount updated');
      } else {
        await discountService.create(payload);
        toast.success('Discount saved');
        setPage(1);
      }
      closeForm();
      await loadDiscounts();
      if (payload.type === 'One Time Discount') {
        notifyPricingPlansChanged();
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to save discount'));
    } finally {
      setSaving(false);
    }
  };

  const toggleRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const togglePage = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
      return;
    }
    setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
  };

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Code copied');
    } catch {
      toast.error('Unable to copy code');
    }
  };

  const handleDelete = async (row) => {
    const confirmed = window.confirm(`Delete discount "${row.name}"? This cannot be undone.`);
    if (!confirmed) return;
    try {
      await discountService.remove(row.id);
      setSelectedIds((prev) => prev.filter((id) => id !== row.id));
      if (editingId === row.id) closeForm();
      toast.success('Discount deleted');
      await loadDiscounts();
      if (row.type === 'One Time Discount') {
        notifyPricingPlansChanged();
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to delete discount'));
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    const confirmed = window.confirm(
      `Delete ${selectedIds.length} selected discount${selectedIds.length > 1 ? 's' : ''}?`
    );
    if (!confirmed) return;
    try {
      await discountService.removeMany(selectedIds);
      toast.success(
        `${selectedIds.length} discount${selectedIds.length > 1 ? 's' : ''} deleted`
      );
      setSelectedIds([]);
      closeForm();
      await loadDiscounts();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to delete discounts'));
    }
  };

  const toggleEnabled = async (row) => {
    const nextEnabled = !row.enabled;
    try {
      await discountService.update(row.id, { enabled: nextEnabled });
      toast.success(nextEnabled ? `"${row.name}" enabled` : `"${row.name}" disabled`);
      await loadDiscounts();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to update discount'));
    }
  };

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-[28px] font-semibold tracking-tight text-[#101828]">
          Discount
        </h1>
        {selectedIds.length > 0 && (
          <button
            type="button"
            onClick={handleBulkDelete}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#D92D20] px-4 text-sm font-semibold text-white transition hover:bg-[#B42318]"
          >
            <Trash2 size={16} />
            Delete selected ({selectedIds.length})
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total" value={stats.total} icon={Tag} />
        <StatCard label="Active" value={stats.active} icon={CheckCircle2} />
        <StatCard label="Scheduled" value={stats.scheduled} icon={Clock3} />
        <StatCard label="Ended" value={stats.ended} icon={CalendarDays} />
        <StatCard label="Disabled" value={stats.disabled} icon={Ban} />
        <StatCard label="Redeemed" value={stats.redeemed} icon={Ticket} />
      </div>

      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by name, code, or description"
              className="h-11 w-full rounded-lg border border-[#D0D5DD] bg-white pl-9 pr-3 text-sm text-[#101828] outline-none placeholder:text-[#98A2B3] focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="h-11 w-full shrink-0 rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#344054] outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:w-auto"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="scheduled">Scheduled</option>
            <option value="ended">Ended</option>
            <option value="disabled">Disabled</option>
          </select>
          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setPage(1);
            }}
            className="h-11 w-full shrink-0 rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#344054] outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:w-auto"
          >
            <option value="">All types</option>
            <option value="simple discount">Simple discount</option>
            <option value="partner discount">Partner discount</option>
            <option value="one time discount">One Time Discount</option>
          </select>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition hover:bg-[#01133F] lg:w-auto"
          style={{ backgroundColor: PRIMARY }}
        >
          <Plus size={18} />
          Add Discount
        </button>
      </div>

      {showForm &&
        (formMode === 'view' ? (
          <DiscountViewPanel form={form} onClose={closeForm} />
        ) : (
          <DiscountForm
            form={form}
            setForm={setForm}
            mode={formMode}
            onClose={closeForm}
            onSave={handleSave}
            saving={saving}
            plans={plans}
          />
        ))}

      <div className="overflow-hidden rounded-xl border border-[#ECEFF3] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#F9FAFB] text-[12px] font-semibold uppercase tracking-[0.04em] text-[#667085]">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = somePageSelected && !allPageSelected;
                    }}
                    onChange={togglePage}
                    aria-label="Select all discounts on this page"
                    className="h-4 w-4 rounded border-[#D0D5DD] text-primary focus:ring-primary"
                  />
                </th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Offer</th>
                <th className="px-4 py-3">Applies To</th>
                <th className="px-4 py-3">Schedule</th>
                <th className="px-4 py-3">Usage</th>
                <th className="px-4 py-3">Enabled</th>
                <th className="px-4 py-3">Lifecycle</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-[#667085]">
                    {loading ? 'Loading discounts...' : 'No discounts found'}
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => {
                  const isSelected = selectedIds.includes(row.id);
                  return (
                    <tr
                      key={row.id}
                      className={`border-t border-[#F2F4F7] ${isSelected ? 'bg-primary-50/40' : ''}`}
                    >
                      <td className="px-4 py-4 align-top">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(row.id)}
                          aria-label={`Select ${row.name}`}
                          className="h-4 w-4 rounded border-[#D0D5DD] text-primary focus:ring-primary"
                        />
                      </td>
                      <td className="px-4 py-4 align-top font-semibold text-[#101828]">
                        {row.name}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-primary">{row.code}</span>
                          <button
                            type="button"
                            onClick={() => copyCode(row.code)}
                            className="inline-flex items-center gap-1 text-[12px] font-medium text-[#667085] hover:text-primary"
                          >
                            <Copy size={12} />
                            Copy
                          </button>
                        </div>
                      </td>
                      <td className="max-w-[220px] px-4 py-4 align-top text-[#344054]">
                        {row.description}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span className="inline-flex rounded-full bg-[#F2F4F7] px-2.5 py-1 text-[12px] font-medium text-[#475467]">
                          {row.type}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span className="inline-flex rounded-full bg-[#F2F4F7] px-2.5 py-1 text-[12px] font-medium text-[#475467]">
                          {row.offer}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top text-[13px] text-[#344054]">
                        {row.appliesTo.map((item) => (
                          <p key={item}>{item}</p>
                        ))}
                      </td>
                      <td className="px-4 py-4 align-top text-[13px] text-[#344054]">
                        <p>From {row.scheduleFrom}</p>
                        <p>Until {row.scheduleUntil}</p>
                      </td>
                      <td className="px-4 py-4 align-top font-medium text-[#101828]">
                        {row.usageUsed} / {row.usageLimit ?? '∞'}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <Toggle
                          checked={Boolean(row.enabled)}
                          label={`${row.enabled ? 'Disable' : 'Enable'} ${row.name}`}
                          onChange={() => toggleEnabled(row)}
                        />
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${lifecycleBadge(row.lifecycle)}`}
                        >
                          {row.lifecycle}
                        </span>
                        <p className="mt-1 max-w-[160px] text-[12px] text-[#667085]">
                          {row.lifecycleNote}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openViewForm(row)}
                            className="h-8 rounded-md border border-primary px-3 text-[12px] font-semibold text-primary transition hover:bg-primary-50"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditForm(row)}
                            className="h-8 rounded-md border border-primary px-3 text-[12px] font-semibold text-primary transition hover:bg-primary-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(row)}
                            className="h-8 rounded-md bg-[#D92D20] px-3 text-[12px] font-semibold text-white transition hover:bg-[#B42318]"
                          >
                            Delete
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

        <div className="flex flex-col gap-3 border-t border-[#F2F4F7] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#667085]">
            {rangeLabel}
            {selectedIds.length > 0 ? ` · ${selectedIds.length} selected` : ''}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium text-[#344054] transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <span className="min-w-[88px] text-center text-sm font-medium text-[#344054]">
              Page {currentPage} of {pages}
            </span>
            <button
              type="button"
              disabled={currentPage >= pages}
              onClick={() => setPage((prev) => Math.min(pages, prev + 1))}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#D0D5DD] px-3 text-sm font-medium text-[#344054] transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
