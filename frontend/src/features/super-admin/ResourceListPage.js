'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Plus, Search, Trash2 } from 'lucide-react';

const PAGE_SIZE = 10;
const PRIMARY = '#021A54';

function statusBadge(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'active' || value === 'enabled') {
    return 'bg-emerald-50 text-emerald-700';
  }
  if (value === 'inactive' || value === 'disabled') {
    return 'bg-gray-100 text-gray-600';
  }
  if (value === 'expired') {
    return 'bg-red-50 text-red-700';
  }
  return 'bg-amber-50 text-amber-700';
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
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

function CellContent({ column, row, onToggle }) {
  if (column.type === 'status') {
    return (
      <span
        className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${statusBadge(row[column.key])}`}
      >
        {row[column.key]}
      </span>
    );
  }

  if (column.type === 'stack') {
    return (
      <div>
        <p className="font-semibold text-[#101828]">{row[column.key]}</p>
        {row[column.subKey] && (
          <p className="mt-0.5 text-[13px] text-[#667085]">{row[column.subKey]}</p>
        )}
      </div>
    );
  }

  if (column.type === 'discounts') {
    const linked = row.discountLinked ?? 0;
    const code = row.discountCode;
    return (
      <div>
        <p className="font-medium text-[#344054]">
          {linked} linked
        </p>
        {code ? (
          <p className="mt-0.5 text-[12px] font-semibold text-primary">{code}</p>
        ) : (
          <p className="mt-0.5 text-[12px] text-[#98A2B3]">No discount</p>
        )}
      </div>
    );
  }

  if (column.type === 'visibility') {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-[#344054]">Website</span>
          <Toggle
            checked={Boolean(row.visibleWebsite)}
            label={`${row.name} website visibility`}
            onChange={() => onToggle(row.id, 'visibleWebsite')}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-[#344054]">Super Admin</span>
          <Toggle
            checked={Boolean(row.visibleSuperAdmin)}
            label={`${row.name} super admin visibility`}
            onChange={() => onToggle(row.id, 'visibleSuperAdmin')}
          />
        </div>
      </div>
    );
  }

  if (column.type === 'toggle') {
    return (
      <Toggle
        checked={Boolean(row[column.key])}
        label={`${row.name} ${column.label}`}
        onChange={() => onToggle(row.id, column.key)}
      />
    );
  }

  return row[column.key];
}

export function ResourceListPage({
  title,
  subtitle,
  addLabel,
  searchPlaceholder,
  columns,
  rows,
  filterOptions,
  actions = ['view', 'edit'],
  selectable = false,
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [tableRows, setTableRows] = useState(rows);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    setTableRows(rows);
    setSelectedIds([]);
  }, [rows]);

  const canSelect = selectable || actions.includes('delete');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tableRows.filter((row) => {
      const searchable = [
        row.name,
        row.code,
        row.price,
        row.billing,
        row.features,
        row.status,
        row.discountCode,
        row.type,
        row.value,
        row.appliesTo,
        row.category,
        row.description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch = !q || searchable.includes(q);
      const matchesFilter = !filter || String(row.status).toLowerCase() === filter;
      return matchesSearch && matchesFilter;
    });
  }, [tableRows, search, filter]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);
  const rangeLabel = filtered.length
    ? `${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} of ${filtered.length}`
    : '0 items';

  const pageIds = pageRows.map((row) => row.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const somePageSelected = pageIds.some((id) => selectedIds.includes(id));

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

  const handleToggle = (id, key) => {
    setTableRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [key]: !row[key] } : row))
    );
  };

  const handleDelete = (row) => {
    const label = row.name || row.code || row.id;
    const confirmed = window.confirm(`Delete "${label}"? This cannot be undone.`);
    if (!confirmed) return;
    setTableRows((prev) => prev.filter((item) => item.id !== row.id));
    setSelectedIds((prev) => prev.filter((id) => id !== row.id));
    toast.success(`${label} deleted`);
  };

  const handleBulkDelete = () => {
    if (!selectedIds.length) return;
    const confirmed = window.confirm(
      `Delete ${selectedIds.length} selected item${selectedIds.length > 1 ? 's' : ''}? This cannot be undone.`
    );
    if (!confirmed) return;
    setTableRows((prev) => prev.filter((item) => !selectedIds.includes(item.id)));
    toast.success(`${selectedIds.length} item${selectedIds.length > 1 ? 's' : ''} deleted`);
    setSelectedIds([]);
  };

  const colSpan = columns.length + 1 + (canSelect ? 1 : 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-[#101828]">
            {title}
          </h1>
          <p className="mt-1 text-sm text-[#667085]">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canSelect && selectedIds.length > 0 && (
            <button
              type="button"
              onClick={handleBulkDelete}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#D92D20] px-4 text-sm font-semibold text-white transition hover:bg-[#B42318]"
            >
              <Trash2 size={16} />
              Delete selected ({selectedIds.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => toast(`${addLabel} coming soon`)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition hover:bg-[#01133F]"
            style={{ backgroundColor: PRIMARY }}
          >
            <Plus size={18} />
            {addLabel}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#ECEFF3] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex flex-col gap-3 border-b border-[#F2F4F7] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-base font-semibold text-[#101828]">All {title}</h2>
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
                placeholder={searchPlaceholder}
                className="h-10 w-full rounded-lg border border-[#D0D5DD] bg-white pl-9 pr-3 text-sm text-[#101828] outline-none placeholder:text-[#98A2B3] focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            {filterOptions?.length > 0 && (
              <select
                value={filter}
                onChange={(event) => {
                  setFilter(event.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#344054] outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                {filterOptions.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#F9FAFB] text-[12px] font-semibold uppercase tracking-[0.04em] text-[#667085]">
              <tr>
                {canSelect && (
                  <th className="w-12 px-5 py-3">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = somePageSelected && !allPageSelected;
                      }}
                      onChange={togglePage}
                      aria-label="Select all on this page"
                      className="h-4 w-4 rounded border-[#D0D5DD] text-primary focus:ring-primary"
                    />
                  </th>
                )}
                {columns.map((column) => (
                  <th key={column.key} className="whitespace-nowrap px-5 py-3">
                    {column.label}
                  </th>
                ))}
                <th className="whitespace-nowrap px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-5 py-12 text-center text-[#667085]">
                    No records found
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
                      {canSelect && (
                        <td className="px-5 py-4 align-top">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(row.id)}
                            aria-label={`Select ${row.name || row.code || row.id}`}
                            className="h-4 w-4 rounded border-[#D0D5DD] text-primary focus:ring-primary"
                          />
                        </td>
                      )}
                      {columns.map((column) => (
                        <td key={column.key} className="px-5 py-4 align-top text-[#344054]">
                          <CellContent column={column} row={row} onToggle={handleToggle} />
                        </td>
                      ))}
                      <td className="px-5 py-4 align-top">
                        <div className="flex flex-wrap items-center gap-2">
                          {actions.includes('view') && (
                            <button
                              type="button"
                              onClick={() => toast(`View ${row.name || row.code || row.id}`)}
                              className="h-8 rounded-md border border-primary px-3 text-[12px] font-semibold text-primary transition hover:bg-primary-50"
                            >
                              View
                            </button>
                          )}
                          {actions.includes('edit') && (
                            <button
                              type="button"
                              onClick={() => toast(`Edit ${row.name || row.code || row.id}`)}
                              className="h-8 rounded-md border border-primary px-3 text-[12px] font-semibold text-primary transition hover:bg-primary-50"
                            >
                              Edit
                            </button>
                          )}
                          {actions.includes('delete') && (
                            <button
                              type="button"
                              onClick={() => handleDelete(row)}
                              className="h-8 rounded-md bg-[#D92D20] px-3 text-[12px] font-semibold text-white transition hover:bg-[#B42318]"
                            >
                              Delete
                            </button>
                          )}
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
            {canSelect && selectedIds.length > 0 ? ` · ${selectedIds.length} selected` : ''}
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
