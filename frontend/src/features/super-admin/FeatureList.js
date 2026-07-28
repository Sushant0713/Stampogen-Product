'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Plus, Search, Trash2, X } from 'lucide-react';
import { featureService } from '@/services/feature.service';
import { getErrorMessage } from '@/utils';

const PAGE_SIZE = 10;
const PRIMARY = '#021A54';

const EMPTY_FORM = {
  name: '',
  code: '',
  category: 'Core',
  description: '',
  status: 'Enabled',
};

const fieldClass =
  'h-11 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none placeholder:text-[#98A2B3] focus:border-primary focus:ring-1 focus:ring-primary';
const labelClass = 'mb-1.5 block text-[13px] font-semibold text-[#344054]';

function statusBadge(status) {
  return String(status).toLowerCase() === 'enabled'
    ? 'bg-emerald-50 text-emerald-700'
    : 'bg-gray-100 text-gray-600';
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

function FeatureViewPanel({ feature, onClose }) {
  return (
    <section
      id="feature-panel"
      className="overflow-hidden rounded-xl border border-[#ECEFF3] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
    >
      <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-primary to-[#01133F] px-5 py-5 text-white sm:px-6">
        <div className="min-w-0">
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-white/70">
            Feature details
          </p>
          <h2 className="mt-1 truncate text-xl font-semibold">{feature.name}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold">
              {feature.code}
            </span>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-[12px] font-semibold ${
                feature.status === 'Enabled'
                  ? 'bg-emerald-400/20 text-emerald-100'
                  : 'bg-white/10 text-white/80'
              }`}
            >
              {feature.status}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close feature view"
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
            {feature.description || 'No description provided.'}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DetailItem label="Category">{feature.category}</DetailItem>
          <DetailItem label="Status">
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${statusBadge(feature.status)}`}
            >
              {feature.status}
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

function FeatureForm({ form, setForm, mode, onClose, onSave, saving = false }) {
  const isEdit = mode === 'edit';
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!form.name.trim()) {
      toast.error('Feature name is required');
      return;
    }
    if (!form.code.trim()) {
      toast.error('Feature code is required');
      return;
    }
    await onSave(form);
  };

  return (
    <section
      id="feature-panel"
      className="rounded-xl border border-[#ECEFF3] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6"
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#101828]">
            {isEdit ? 'Edit Feature' : 'New Feature'}
          </h2>
          <p className="mt-1 text-sm text-[#667085]">
            Configure feature details used across subscription plans.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close feature form"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D0D5DD] text-[#667085] transition hover:bg-[#F9FAFB] hover:text-primary"
        >
          <X size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="feature-name">
              Feature Name
            </label>
            <input
              id="feature-name"
              className={fieldClass}
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
              placeholder="Enter feature name"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="feature-code">
              Feature Code
            </label>
            <input
              id="feature-code"
              className={fieldClass}
              value={form.code}
              onChange={(event) => update('code', event.target.value)}
              placeholder="e.g. users.manage"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="feature-category">
              Category
            </label>
            <select
              id="feature-category"
              className={fieldClass}
              value={form.category}
              onChange={(event) => update('category', event.target.value)}
            >
              <option>Core</option>
              <option>Brand</option>
              <option>Analytics</option>
              <option>Integrations</option>
              <option>Support</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="feature-status">
              Status
            </label>
            <select
              id="feature-status"
              className={fieldClass}
              value={form.status}
              onChange={(event) => update('status', event.target.value)}
            >
              <option>Enabled</option>
              <option>Disabled</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className={labelClass} htmlFor="feature-description">
              Description
            </label>
            <textarea
              id="feature-description"
              rows={3}
              className="w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm text-[#101828] outline-none placeholder:text-[#98A2B3] focus:border-primary focus:ring-1 focus:ring-primary"
              value={form.description}
              onChange={(event) => update('description', event.target.value)}
              placeholder="Describe what this feature does"
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
            {saving ? 'Saving...' : isEdit ? 'Update Feature' : 'Save Feature'}
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
  );
}

export function FeatureList() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [panelMode, setPanelMode] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [viewFeature, setViewFeature] = useState(null);

  const loadFeatures = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await featureService.getAll({ limit: 200 });
      setRows(data.data.features || []);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to load features'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeatures();
  }, [loadFeatures]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch =
        !q ||
        [row.name, row.code, row.category, row.description].join(' ').toLowerCase().includes(q);
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
      document.getElementById('feature-panel')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const closePanel = () => {
    setPanelMode(null);
    setEditingId(null);
    setViewFeature(null);
    setForm(EMPTY_FORM);
  };

  const openCreate = () => {
    setPanelMode('create');
    setEditingId(null);
    setViewFeature(null);
    setForm(EMPTY_FORM);
    scrollToPanel();
  };

  const openView = (row) => {
    setPanelMode('view');
    setViewFeature(row);
    setEditingId(null);
    scrollToPanel();
  };

  const openEdit = (row) => {
    setPanelMode('edit');
    setEditingId(row.id);
    setViewFeature(null);
    setForm({
      name: row.name,
      code: row.code,
      category: row.category,
      description: row.description === '—' ? '' : row.description || '',
      status: row.status,
    });
    scrollToPanel();
  };

  const handleSave = async (values) => {
    const payload = {
      name: values.name.trim(),
      code: values.code.trim(),
      category: values.category,
      description: values.description.trim(),
      status: values.status,
    };

    try {
      setSaving(true);
      if (panelMode === 'edit' && editingId) {
        await featureService.update(editingId, payload);
        toast.success('Feature updated');
      } else {
        await featureService.create(payload);
        toast.success('Feature saved');
        setPage(1);
      }
      closePanel();
      await loadFeatures();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to save feature'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    const confirmed = window.confirm(`Delete feature "${row.name}"? This cannot be undone.`);
    if (!confirmed) return;
    try {
      await featureService.remove(row.id);
      setSelectedIds((prev) => prev.filter((id) => id !== row.id));
      if (editingId === row.id || viewFeature?.id === row.id) closePanel();
      toast.success('Feature deleted');
      await loadFeatures();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to delete feature'));
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    const confirmed = window.confirm(
      `Delete ${selectedIds.length} selected feature${selectedIds.length > 1 ? 's' : ''}?`
    );
    if (!confirmed) return;
    try {
      await featureService.removeMany(selectedIds);
      toast.success(`${selectedIds.length} feature${selectedIds.length > 1 ? 's' : ''} deleted`);
      setSelectedIds([]);
      closePanel();
      await loadFeatures();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to delete features'));
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
            Feature list
          </h1>
          <p className="mt-1 text-sm text-[#667085]">
            Define features that can be attached to plans.
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
            Add Feature
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
            placeholder="Search feature name or code"
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
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {panelMode === 'view' && viewFeature && (
        <FeatureViewPanel feature={viewFeature} onClose={closePanel} />
      )}
      {(panelMode === 'create' || panelMode === 'edit') && (
        <FeatureForm
          form={form}
          setForm={setForm}
          mode={panelMode}
          onClose={closePanel}
          onSave={handleSave}
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
                    aria-label="Select all features on this page"
                    className="h-4 w-4 rounded border-[#D0D5DD] text-primary focus:ring-primary"
                  />
                </th>
                <th className="px-4 py-3">Feature</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[#667085]">
                    {loading ? 'Loading features...' : 'No features found'}
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
                      <td className="px-4 py-4 align-top text-[#344054]">{row.category}</td>
                      <td className="max-w-[260px] px-4 py-4 align-top text-[#344054]">
                        {row.description}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${statusBadge(row.status)}`}
                        >
                          {row.status}
                        </span>
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
