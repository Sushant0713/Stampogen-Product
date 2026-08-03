'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Plus, Search, Trash2, X } from 'lucide-react';
import { planService } from '@/services/plan.service';
import { featureService } from '@/services/feature.service';
import { getErrorMessage } from '@/utils';
import { notifyPricingPlansChanged } from '@/utils/pricingSync';

const PAGE_SIZE = 10;
const PRIMARY = '#021A54';

const EMPTY_FORM = {
  name: '',
  code: '',
  priceAmount: '',
  mrpAmount: '',
  priceCustom: false,
  billing: 'Monthly',
  featureIds: [],
  status: 'Active',
  users: 0,
  usersUnlimited: false,
  discountLinked: 0,
  discountCode: '',
  visibleWebsite: false,
  visibleSuperAdmin: true,
  enabled: true,
  description: '',
  ctaText: 'Get early access',
  featuredOnWebsite: false,
  badgeText: 'MOST STAMPED',
  forOutlet: false,
};

const fieldClass =
  'h-11 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none placeholder:text-[#98A2B3] focus:border-primary focus:ring-1 focus:ring-primary';
const labelClass = 'mb-1.5 block text-[13px] font-semibold text-[#344054]';

function formatPrice(plan) {
  if (plan.priceCustom) return 'Custom';
  const amount = Number(plan.priceAmount) || 0;
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
  if (plan.billing === 'Yearly') return `${formatted} / yr`;
  if (plan.billing === 'Monthly') return `${formatted} / mo`;
  return formatted;
}

function getSelectedFeatures(featureIds = [], catalog = []) {
  return catalog.filter((feature) => featureIds.includes(feature.id));
}

function resolvePlanFeatures(plan, catalog = []) {
  if (Array.isArray(plan.features) && plan.features.length) {
    return plan.features;
  }
  return getSelectedFeatures(plan.featureIds || [], catalog);
}

function formatFeaturesLabel(featureIds = []) {
  const count = featureIds.length;
  if (!count) return 'No features';
  return `${count} feature${count === 1 ? '' : 's'}`;
}

function statusBadge(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'active') return 'bg-emerald-50 text-emerald-700';
  if (value === 'inactive') return 'bg-gray-100 text-gray-600';
  return 'bg-amber-50 text-amber-700';
}

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

function PlanViewPanel({ plan, onClose, availableFeatures = [] }) {
  const selectedFeatures = resolvePlanFeatures(plan, availableFeatures);
  return (
    <section
      id="plan-panel"
      className="overflow-hidden rounded-xl border border-[#ECEFF3] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
    >
      <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-primary to-[#01133F] px-5 py-5 text-white sm:px-6">
        <div className="min-w-0">
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-white/70">
            Plan details
          </p>
          <h2 className="mt-1 truncate text-xl font-semibold">{plan.name}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold">
              {plan.code}
            </span>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-[12px] font-semibold ${
                plan.status === 'Active'
                  ? 'bg-emerald-400/20 text-emerald-100'
                  : 'bg-white/10 text-white/80'
              }`}
            >
              {plan.status}
            </span>
            <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold">
              {plan.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close plan view"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/20"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div className="rounded-xl border border-[#EAECF0] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
            Description
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[#344054]">
            {plan.description || 'No description provided.'}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DetailItem label="Button text">{plan.ctaText || 'Get early access'}</DetailItem>
          <DetailItem label="Pricing badge">
            {plan.featuredOnWebsite ? plan.badgeText || 'MOST STAMPED' : 'Off'}
          </DetailItem>
          <DetailItem label="Price">{formatPrice(plan)}</DetailItem>
          <DetailItem label="MRP">
            {plan.priceCustom || !(Number(plan.mrpAmount) > 0)
              ? '—'
              : new Intl.NumberFormat('en-IN', {
                  style: 'currency',
                  currency: 'INR',
                  maximumFractionDigits: 0,
                }).format(Number(plan.mrpAmount))}
          </DetailItem>
          <DetailItem label="Billing">{plan.billing}</DetailItem>
          <DetailItem label="Features">
            <p>{formatFeaturesLabel(plan.featureIds)}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedFeatures.length === 0 ? (
                <span className="text-[12px] font-normal text-[#98A2B3]">None selected</span>
              ) : (
                selectedFeatures.map((feature) => (
                  <span
                    key={feature.id}
                    className="inline-flex rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-primary ring-1 ring-[#D0D5DD]"
                  >
                    {feature.name}
                  </span>
                ))
              )}
            </div>
          </DetailItem>
          <DetailItem label="Users limit">
            {plan.usersLimitLabel || (plan.usersUnlimited ? 'Unlimited' : plan.users ?? 0)}
          </DetailItem>
          <DetailItem label="Active users">{plan.activeUsers ?? 0}</DetailItem>
          <DetailItem label="Discounts">
            <p>{plan.discountLinked ?? 0} linked</p>
            <p className="mt-1 text-[12px] font-semibold text-primary">
              {plan.discountCode || 'No discount'}
            </p>
          </DetailItem>
          <DetailItem label="Website">
            {plan.visibleWebsite ? 'Visible' : 'Hidden'}
          </DetailItem>
          <DetailItem label="Super Admin">
            {plan.visibleSuperAdmin ? 'Visible' : 'Hidden'}
          </DetailItem>
          <DetailItem label="Status">
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${statusBadge(plan.status)}`}
            >
              {plan.status}
            </span>
          </DetailItem>
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

function FeaturePickerModal({ selectedIds, onClose, onApply, availableFeatures = [] }) {
  const [search, setSearch] = useState('');
  const [draftIds, setDraftIds] = useState(selectedIds);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return availableFeatures.filter((feature) => {
      if (!q) return true;
      return [feature.name, feature.code, feature.category, feature.description]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [search, availableFeatures]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((feature) => draftIds.includes(feature.id));

  const toggleFeature = (id) => {
    setDraftIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleAllFiltered = () => {
    if (allFilteredSelected) {
      const filteredIds = new Set(filtered.map((feature) => feature.id));
      setDraftIds((prev) => prev.filter((id) => !filteredIds.has(id)));
      return;
    }
    setDraftIds((prev) => Array.from(new Set([...prev, ...filtered.map((feature) => feature.id)])));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close feature picker"
        className="absolute inset-0 bg-[#101828]/55"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feature-picker-title"
        className="relative z-10 flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_20px_40px_rgba(16,24,40,0.18)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#F2F4F7] px-5 py-4">
          <div>
            <h3 id="feature-picker-title" className="text-lg font-semibold text-[#101828]">
              Add features
            </h3>
            <p className="mt-1 text-sm text-[#667085]">
              Search and select multiple features for this plan.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D0D5DD] text-[#667085] transition hover:bg-[#F9FAFB] hover:text-primary"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 border-b border-[#F2F4F7] px-5 py-4">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]"
            />
            <input
              type="search"
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search features by name or code"
              className="h-11 w-full rounded-lg border border-[#D0D5DD] bg-white pl-9 pr-3 text-sm text-[#101828] outline-none placeholder:text-[#98A2B3] focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-[#344054]">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleAllFiltered}
                className="h-4 w-4 rounded border-[#D0D5DD] text-primary focus:ring-primary"
              />
              Select all shown
            </label>
            <p className="text-sm text-[#667085]">
              {draftIds.length} selected
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {availableFeatures.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-[#667085]">
              No features in database yet. Create features in Feature list first.
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-[#667085]">No features found</p>
          ) : (
            filtered.map((feature) => {
              const checked = draftIds.includes(feature.id);
              return (
                <label
                  key={feature.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl px-3 py-3 transition hover:bg-[#F9FAFB] ${
                    checked ? 'bg-primary-50/60' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleFeature(feature.id)}
                    className="mt-1 h-4 w-4 rounded border-[#D0D5DD] text-primary focus:ring-primary"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-[#101828]">{feature.name}</span>
                      <span className="rounded-full bg-[#F2F4F7] px-2 py-0.5 text-[11px] font-medium text-[#667085]">
                        {feature.category}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[12px] text-[#667085]">{feature.code}</span>
                    <span className="mt-1 block text-[13px] text-[#475467]">
                      {feature.description}
                    </span>
                  </span>
                </label>
              );
            })
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#F2F4F7] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-primary px-5 text-sm font-semibold text-primary transition hover:bg-primary-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onApply(draftIds)}
            className="inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold text-white transition hover:bg-[#01133F]"
            style={{ backgroundColor: PRIMARY }}
          >
            Add selected ({draftIds.length})
          </button>
        </div>
      </div>
    </div>
  );
}

function PlanForm({ form, setForm, mode, onClose, onSave, availableFeatures = [], saving = false }) {
  const isEdit = mode === 'edit';
  const [featurePickerOpen, setFeaturePickerOpen] = useState(false);
  const selectedFeatures = getSelectedFeatures(form.featureIds, availableFeatures);
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const removeFeature = (id) => {
    update(
      'featureIds',
      form.featureIds.filter((item) => item !== id)
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!form.name.trim()) {
      toast.error('Plan name is required');
      return;
    }
    if (!form.code.trim()) {
      toast.error('Plan code is required');
      return;
    }
    if (!form.priceCustom && form.priceAmount === '') {
      toast.error('Price is required');
      return;
    }
    await onSave(form);
  };

  return (
    <>
      <section
        id="plan-panel"
        className="rounded-xl border border-[#ECEFF3] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#101828]">
              {isEdit ? 'Edit Plan' : 'New Plan'}
            </h2>
            <p className="mt-1 text-sm text-[#667085]">
              Configure pricing, billing, visibility, and plan availability.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close plan form"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D0D5DD] text-[#667085] transition hover:bg-[#F9FAFB] hover:text-primary"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="plan-name">
                Plan Name
              </label>
              <input
                id="plan-name"
                className={fieldClass}
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
                placeholder="e.g. Growth"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="plan-code">
                Plan Code
              </label>
              <input
                id="plan-code"
                className={fieldClass}
                value={form.code}
                onChange={(event) => update('code', event.target.value)}
                placeholder="e.g. growth"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="plan-billing">
                Billing
              </label>
              <select
                id="plan-billing"
                className={fieldClass}
                value={form.billing}
                onChange={(event) => update('billing', event.target.value)}
              >
                <option>Monthly</option>
                <option>Yearly</option>
                <option>Custom</option>
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="plan-status">
                Status
              </label>
              <select
                id="plan-status"
                className={fieldClass}
                value={form.status}
                onChange={(event) => update('status', event.target.value)}
              >
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <label className="text-[13px] font-semibold text-[#344054]" htmlFor="plan-price">
                  Selling price (INR)
                </label>
                <label className="inline-flex items-center gap-2 text-[12px] font-medium text-[#667085]">
                  <input
                    type="checkbox"
                    checked={form.priceCustom}
                    onChange={(event) => update('priceCustom', event.target.checked)}
                    className="h-4 w-4 rounded border-[#D0D5DD] text-primary focus:ring-primary"
                  />
                  Custom pricing
                </label>
              </div>
              <input
                id="plan-price"
                type="number"
                min="0"
                disabled={form.priceCustom}
                className={`${fieldClass} disabled:cursor-not-allowed disabled:bg-[#F9FAFB]`}
                value={form.priceCustom ? '' : form.priceAmount}
                onChange={(event) => update('priceAmount', event.target.value)}
                placeholder={form.priceCustom ? 'Custom' : 'e.g. 499'}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="plan-mrp">
                MRP (INR)
              </label>
              <input
                id="plan-mrp"
                type="number"
                min="0"
                disabled={form.priceCustom}
                className={`${fieldClass} disabled:cursor-not-allowed disabled:bg-[#F9FAFB]`}
                value={form.priceCustom ? '' : form.mrpAmount}
                onChange={(event) => update('mrpAmount', event.target.value)}
                placeholder={form.priceCustom ? '—' : 'e.g. 599'}
              />
              <p className="mt-1 text-[11px] text-[#98A2B3]">
                Shown struck through above selling price on the website when higher
              </p>
            </div>
            <div>
              <label className={labelClass} htmlFor="plan-users">
                Users limit
              </label>
              <input
                id="plan-users"
                type="number"
                min="0"
                disabled={form.usersUnlimited}
                className={`${fieldClass} disabled:cursor-not-allowed disabled:bg-[#F9FAFB]`}
                value={form.usersUnlimited ? '' : form.users}
                onChange={(event) => update('users', Number(event.target.value) || 0)}
                placeholder={form.usersUnlimited ? 'Unlimited' : 'e.g. 5'}
              />
              <label className="mt-2 flex items-center gap-2 text-[13px] font-medium text-[#344054]">
                <input
                  type="checkbox"
                  checked={Boolean(form.usersUnlimited)}
                  onChange={(event) => update('usersUnlimited', event.target.checked)}
                  className="h-4 w-4 rounded border-[#D0D5DD] text-primary focus:ring-primary"
                />
                Unlimited (no user limit)
              </label>
            </div>

            <div className="lg:col-span-2">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <label className="text-[13px] font-semibold text-[#344054]">Features</label>
                <span className="text-[12px] font-medium text-[#667085]">
                  {formatFeaturesLabel(form.featureIds)}
                </span>
              </div>
              <div className="rounded-xl border border-[#D0D5DD] bg-white p-3">
                {selectedFeatures.length === 0 ? (
                  <p className="mb-3 text-sm text-[#98A2B3]">No features selected yet.</p>
                ) : (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {selectedFeatures.map((feature) => (
                      <span
                        key={feature.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1.5 text-[12px] font-semibold text-primary"
                      >
                        {feature.name}
                        <button
                          type="button"
                          onClick={() => removeFeature(feature.id)}
                          aria-label={`Remove ${feature.name}`}
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-primary/70 transition hover:bg-primary hover:text-white"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setFeaturePickerOpen(true)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-primary px-4 text-sm font-semibold text-primary transition hover:bg-primary-50"
                >
                  <Plus size={16} />
                  Add feature
                </button>
              </div>
            </div>

            <div>
              <label className={labelClass} htmlFor="plan-discount-linked">
                Linked Discounts
              </label>
              <input
                id="plan-discount-linked"
                type="number"
                min="0"
                readOnly
                className={`${fieldClass} cursor-default bg-[#F9FAFB]`}
                value={form.discountLinked}
              />
              <p className="mt-1 text-[11px] text-[#98A2B3]">
                Auto-counted from discounts with this plan selected
              </p>
            </div>
            <div>
              <label className={labelClass} htmlFor="plan-discount-code">
                Discount Code
              </label>
              <input
                id="plan-discount-code"
                readOnly
                className={`${fieldClass} cursor-default bg-[#F9FAFB]`}
                value={form.discountCode}
                placeholder="Set via Discount → Specific Plan"
              />
              <p className="mt-1 text-[11px] text-[#98A2B3]">
                Pulled from the latest discount linked to this plan
              </p>
            </div>
            <div className="lg:col-span-2">
              <label className={labelClass} htmlFor="plan-description">
                Description
              </label>
              <textarea
                id="plan-description"
                rows={3}
                className="w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm text-[#101828] outline-none placeholder:text-[#98A2B3] focus:border-primary focus:ring-1 focus:ring-primary"
                value={form.description}
                onChange={(event) => update('description', event.target.value)}
                placeholder="Describe who this plan is for"
              />
            </div>
            <div className="lg:col-span-2">
              <label className={labelClass} htmlFor="plan-cta-text">
                Pricing button text
              </label>
              <input
                id="plan-cta-text"
                className={fieldClass}
                value={form.ctaText}
                onChange={(event) => update('ctaText', event.target.value)}
                placeholder="Get early access"
                maxLength={60}
              />
              <p className="mt-1 text-[11px] text-[#98A2B3]">
                Button label on /pricing. If the plan is disabled, this same text is shown as a
                toast when the button is clicked (no checkout).
              </p>
            </div>
            <div className="lg:col-span-2 rounded-xl border border-[#F2F4F7] bg-[#F9FAFB] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-sm font-medium text-[#344054]">Featured badge on pricing</span>
                  <p className="mt-0.5 text-[11px] text-[#98A2B3]">
                    On = show badge + highlight border on /pricing
                  </p>
                </div>
                <Toggle
                  checked={form.featuredOnWebsite}
                  label="Featured badge on pricing"
                  onChange={() => update('featuredOnWebsite', !form.featuredOnWebsite)}
                />
              </div>
              {form.featuredOnWebsite ? (
                <div className="mt-3">
                  <label className={labelClass} htmlFor="plan-badge-text">
                    Badge text
                  </label>
                  <input
                    id="plan-badge-text"
                    className={fieldClass}
                    value={form.badgeText}
                    onChange={(event) => update('badgeText', event.target.value)}
                    placeholder="MOST STAMPED"
                    maxLength={40}
                  />
                  <p className="mt-1 text-[11px] text-[#98A2B3]">
                    Examples: MOST STAMPED, POPULAR, BEST VALUE
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 rounded-xl border border-[#F2F4F7] bg-[#F9FAFB] p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-sm font-medium text-[#344054]">Website visibility</span>
                <p className="mt-0.5 text-[11px] text-[#98A2B3]">Off = hidden on /pricing</p>
              </div>
              <Toggle
                checked={form.visibleWebsite}
                label="Website visibility"
                onChange={() => update('visibleWebsite', !form.visibleWebsite)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-sm font-medium text-[#344054]">Super Admin visibility</span>
                <p className="mt-0.5 text-[11px] text-[#98A2B3]">Off = hidden in Plan list</p>
              </div>
              <Toggle
                checked={form.visibleSuperAdmin}
                label="Super Admin visibility"
                onChange={() => update('visibleSuperAdmin', !form.visibleSuperAdmin)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-sm font-medium text-[#344054]">Enabled</span>
                <p className="mt-0.5 text-[11px] text-[#98A2B3]">
                  Off = still on /pricing if visible; button shows toast only
                </p>
              </div>
              <Toggle
                checked={form.enabled}
                label="Plan enabled"
                onChange={() => update('enabled', !form.enabled)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-sm font-medium text-[#344054]">Plan for outlet</span>
                <p className="mt-0.5 text-[11px] text-[#98A2B3]">
                  1 purchase = 1 outlet seat for main admins
                </p>
              </div>
              <Toggle
                checked={Boolean(form.forOutlet)}
                label="Plan for outlet"
                onChange={() => update('forOutlet', !form.forOutlet)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold text-white transition hover:bg-[#01133F] disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: PRIMARY }}
            >
              {saving ? 'Saving...' : isEdit ? 'Update Plan' : 'Save Plan'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-primary px-5 text-sm font-semibold text-primary transition hover:bg-primary-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </section>

      {featurePickerOpen && (
        <FeaturePickerModal
          selectedIds={form.featureIds}
          availableFeatures={availableFeatures}
          onClose={() => setFeaturePickerOpen(false)}
          onApply={(ids) => {
            update('featureIds', ids);
            setFeaturePickerOpen(false);
            toast.success(
              ids.length
                ? `${ids.length} feature${ids.length === 1 ? '' : 's'} selected`
                : 'Features cleared'
            );
          }}
        />
      )}
    </>
  );
}

export function PlanList() {
  const [rows, setRows] = useState([]);
  const [availableFeatures, setAvailableFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showHidden, setShowHidden] = useState(false);
  const [panelMode, setPanelMode] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [viewPlan, setViewPlan] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [{ data: plansRes }, { data: featuresRes }] = await Promise.all([
        planService.getAll({
          limit: 200,
          ...(showHidden ? { includeHidden: true } : {}),
        }),
        featureService.getAll({ limit: 200 }),
      ]);
      setRows(plansRes.data.plans || []);
      setAvailableFeatures(featuresRes.data.features || []);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to load plans'));
    } finally {
      setLoading(false);
    }
  }, [showHidden]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch =
        !q ||
        [row.name, row.code, row.billing, row.discountCode, row.description, formatFeaturesLabel(row.featureIds)]
          .join(' ')
          .toLowerCase()
          .includes(q);
      const matchesStatus = !status || row.status.toLowerCase() === status;
      return matchesSearch && matchesStatus;
    });
  }, [rows, search, status]);

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

  const scrollToPanel = () => {
    requestAnimationFrame(() => {
      document.getElementById('plan-panel')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const closePanel = () => {
    setPanelMode(null);
    setEditingId(null);
    setViewPlan(null);
    setForm(EMPTY_FORM);
  };

  const openCreate = () => {
    setPanelMode('create');
    setEditingId(null);
    setViewPlan(null);
    setForm(EMPTY_FORM);
    scrollToPanel();
  };

  const openView = (row) => {
    setPanelMode('view');
    setViewPlan(row);
    setEditingId(null);
    scrollToPanel();
  };

  const openEdit = (row) => {
    setPanelMode('edit');
    setEditingId(row.id);
    setViewPlan(null);
    setForm({
      name: row.name,
      code: row.code,
      priceAmount: row.priceCustom ? '' : String(row.priceAmount ?? ''),
      mrpAmount: row.priceCustom ? '' : String(row.mrpAmount ?? ''),
      priceCustom: Boolean(row.priceCustom),
      billing: row.billing,
      featureIds: Array.isArray(row.featureIds) ? [...row.featureIds] : [],
      status: row.status,
      users: row.users ?? 0,
      usersUnlimited: Boolean(row.usersUnlimited),
      discountLinked: row.discountLinked ?? 0,
      discountCode: row.discountCode || '',
      visibleWebsite: Boolean(row.visibleWebsite),
      visibleSuperAdmin: Boolean(row.visibleSuperAdmin),
      enabled: Boolean(row.enabled),
      description: row.description || '',
      ctaText: row.ctaText || 'Get early access',
      featuredOnWebsite: Boolean(row.featuredOnWebsite),
      badgeText: row.badgeText || 'MOST STAMPED',
      forOutlet: Boolean(row.forOutlet),
    });
    scrollToPanel();
  };

  const handleSave = async (values) => {
    const payload = {
      name: values.name.trim(),
      code: values.code.trim().toLowerCase(),
      priceAmount: values.priceCustom ? 0 : Number(values.priceAmount) || 0,
      mrpAmount: values.priceCustom ? 0 : Number(values.mrpAmount) || 0,
      priceCustom: Boolean(values.priceCustom),
      billing: values.billing,
      featureIds: Array.isArray(values.featureIds) ? values.featureIds : [],
      status: values.status,
      users: values.usersUnlimited ? 0 : Number(values.users) || 0,
      usersUnlimited: Boolean(values.usersUnlimited),
      discountLinked: Number(values.discountLinked) || 0,
      discountCode: values.discountCode.trim(),
      visibleWebsite: Boolean(values.visibleWebsite),
      visibleSuperAdmin: Boolean(values.visibleSuperAdmin),
      enabled: Boolean(values.enabled),
      description: values.description.trim(),
      ctaText: values.ctaText.trim() || 'Get early access',
      featuredOnWebsite: Boolean(values.featuredOnWebsite),
      badgeText: String(values.badgeText || '').trim() || 'MOST STAMPED',
      forOutlet: Boolean(values.forOutlet),
    };

    try {
      setSaving(true);
      if (panelMode === 'edit' && editingId) {
        await planService.update(editingId, payload);
        toast.success('Plan updated');
      } else {
        await planService.create(payload);
        toast.success('Plan saved');
        setPage(1);
      }
      closePanel();
      await loadData();
      notifyPricingPlansChanged();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to save plan'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    const confirmed = window.confirm(`Delete plan "${row.name}"? This cannot be undone.`);
    if (!confirmed) return;
    try {
      await planService.remove(row.id);
      setSelectedIds((prev) => prev.filter((id) => id !== row.id));
      if (editingId === row.id || viewPlan?.id === row.id) closePanel();
      toast.success('Plan deleted');
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to delete plan'));
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    const confirmed = window.confirm(
      `Delete ${selectedIds.length} selected plan${selectedIds.length > 1 ? 's' : ''}?`
    );
    if (!confirmed) return;
    try {
      await planService.removeMany(selectedIds);
      toast.success(`${selectedIds.length} plan${selectedIds.length > 1 ? 's' : ''} deleted`);
      setSelectedIds([]);
      closePanel();
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to delete plans'));
    }
  };

  const handleToggle = async (id, key) => {
    const row = rows.find((item) => item.id === id);
    if (!row) return;
    const nextValue = !row[key];
    const payload = { [key]: nextValue };
    if (key === 'enabled') {
      payload.status = nextValue ? 'Active' : 'Inactive';
    }
    if (key === 'featuredOnWebsite' && nextValue) {
      payload.badgeText = row.badgeText || 'MOST STAMPED';
    }
    try {
      const { data } = await planService.update(id, payload);
      const updated = data.data.plan;

      // When Super Admin visibility is turned off and hidden plans are not shown, drop the row
      if (key === 'visibleSuperAdmin' && !nextValue && !showHidden) {
        setRows((prev) => prev.filter((item) => item.id !== id));
        if (viewPlan?.id === id) setViewPlan(null);
        if (editingId === id) {
          setPanelMode(null);
          setEditingId(null);
        }
        toast.success('Plan hidden from Super Admin list');
        return;
      }

      setRows((prev) => prev.map((item) => (item.id === id ? updated : item)));
      if (viewPlan?.id === id) setViewPlan(updated);
      if (editingId === id) {
        setForm((prev) => ({
          ...prev,
          featuredOnWebsite: Boolean(updated.featuredOnWebsite),
          badgeText: updated.badgeText || prev.badgeText || 'MOST STAMPED',
        }));
      }

      if (key === 'visibleWebsite' || key === 'enabled' || key === 'featuredOnWebsite') {
        notifyPricingPlansChanged();
      }

      if (key === 'visibleWebsite') {
        toast.success(
          nextValue ? 'Plan visible on website' : 'Plan hidden from website pricing'
        );
      }
      if (key === 'featuredOnWebsite') {
        toast.success(
          nextValue
            ? `Pricing badge on (${updated.badgeText || 'MOST STAMPED'})`
            : 'Pricing badge off'
        );
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to update plan'));
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

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-[#101828]">
            Plan list
          </h1>
          <p className="mt-1 text-sm text-[#667085]">
            Create and manage subscription plans for clients.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={handleBulkDelete}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#D92D20] px-4 text-sm font-semibold text-white transition hover:bg-[#B42318]"
            >
              <Trash2 size={16} />
              Delete selected ({selectedIds.length})
            </button>
          )}
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition hover:bg-[#01133F]"
            style={{ backgroundColor: PRIMARY }}
          >
            <Plus size={18} />
            Add Plan
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-[240px] flex-1">
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
            placeholder="Search plan name or code"
            className="h-11 w-full rounded-lg border border-[#D0D5DD] bg-white pl-9 pr-3 text-sm text-[#101828] outline-none placeholder:text-[#98A2B3] focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className="h-11 rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#344054] outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm font-medium text-[#344054]">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(event) => {
              setShowHidden(event.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 rounded border-[#D0D5DD] text-primary focus:ring-primary"
          />
          Show hidden (Super Admin off)
        </label>
      </div>

      {panelMode === 'view' && viewPlan && (
        <PlanViewPanel
          plan={viewPlan}
          onClose={closePanel}
          availableFeatures={availableFeatures}
        />
      )}
      {(panelMode === 'create' || panelMode === 'edit') && (
        <PlanForm
          form={form}
          setForm={setForm}
          mode={panelMode}
          onClose={closePanel}
          onSave={handleSave}
          availableFeatures={availableFeatures}
          saving={saving}
        />
      )}

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
                    aria-label="Select all plans on this page"
                    className="h-4 w-4 rounded border-[#D0D5DD] text-primary focus:ring-primary"
                  />
                </th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Billing</th>
                <th className="px-4 py-3">Features</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Users limit</th>
                <th className="px-4 py-3">Active users</th>
                <th className="px-4 py-3">Discounts</th>
                <th className="px-4 py-3">Visibility</th>
                <th className="px-4 py-3">Enabled</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-[#667085]">
                    {loading ? 'Loading plans...' : 'No plans found'}
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
                      <td className="px-4 py-4 align-top">
                        <p className="font-semibold text-[#101828]">{row.name}</p>
                        <p className="mt-0.5 text-[13px] text-[#667085]">{row.code}</p>
                      </td>
                      <td className="px-4 py-4 align-top font-medium text-[#101828]">
                        {formatPrice(row)}
                      </td>
                      <td className="px-4 py-4 align-top text-[#344054]">{row.billing}</td>
                      <td className="px-4 py-4 align-top text-[#344054]">
                        {formatFeaturesLabel(row.featureIds)}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${statusBadge(row.status)}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top font-medium text-[#101828]">
                        {row.usersLimitLabel ||
                          (row.usersUnlimited ? 'Unlimited' : row.users ?? 0)}
                      </td>
                      <td className="px-4 py-4 align-top font-medium text-[#101828]">
                        {row.activeUsers ?? 0}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-medium text-[#344054]">{row.discountLinked} linked</p>
                        {row.discountCode ? (
                          <p className="mt-0.5 text-[12px] font-semibold text-primary">
                            {row.discountCode}
                          </p>
                        ) : (
                          <p className="mt-0.5 text-[12px] text-[#98A2B3]">No discount</p>
                        )}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[13px] text-[#344054]">Website</span>
                            <Toggle
                              checked={Boolean(row.visibleWebsite)}
                              label={`${row.name} website visibility`}
                              onChange={() => handleToggle(row.id, 'visibleWebsite')}
                            />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[13px] text-[#344054]">Badge</span>
                            <Toggle
                              checked={Boolean(row.featuredOnWebsite)}
                              label={`${row.name} pricing badge`}
                              onChange={() => handleToggle(row.id, 'featuredOnWebsite')}
                            />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[13px] text-[#344054]">Super Admin</span>
                            <Toggle
                              checked={Boolean(row.visibleSuperAdmin)}
                              label={`${row.name} super admin visibility`}
                              onChange={() => handleToggle(row.id, 'visibleSuperAdmin')}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <Toggle
                          checked={Boolean(row.enabled)}
                          label={`${row.name} enabled`}
                          onChange={() => handleToggle(row.id, 'enabled')}
                        />
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openView(row)}
                            className="h-8 rounded-md border border-primary px-3 text-[12px] font-semibold text-primary transition hover:bg-primary-50"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
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
