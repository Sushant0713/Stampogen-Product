'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Search, ShieldCheck } from 'lucide-react';
import { userService } from '@/services/user.service';
import { ROLES } from '@/constants';
import { getErrorMessage } from '@/utils';

const PAGE_SIZE = 10;
const ACCENT = '#021A54';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function displayName(user) {
  return (
    user?.fullName ||
    [user?.firstName, user?.middleName, user?.lastName].filter(Boolean).join(' ').trim() ||
    '—'
  );
}

export function SuperAdminList() {
  const [admins, setAdmins] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadAdmins = useCallback(
    async (page = 1, { silent = false } = {}) => {
      try {
        if (!silent) setLoading(true);
        const { data } = await userService.getAll({
          role: ROLES.SUPER_ADMIN,
          page,
          limit: PAGE_SIZE,
          search: debouncedSearch || undefined,
          isActive: status || undefined,
        });

        setAdmins(data.data.users || []);
        setPagination(
          data.data.pagination || { page: 1, limit: PAGE_SIZE, total: 0, pages: 1 }
        );
      } catch (error) {
        if (!silent) toast.error(getErrorMessage(error, 'Unable to load super admins'));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [debouncedSearch, status]
  );

  useEffect(() => {
    loadAdmins(1);
  }, [loadAdmins]);

  const totalPages = Math.max(1, pagination.pages || 1);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#101828]">
            Super Admin List
          </h1>
          <p className="mt-1 text-sm text-[#667085]">
            All accounts with the Super Admin role on the platform.
          </p>
        </div>
        <div
          className="inline-flex items-center gap-2 rounded-xl border border-[#ECEFF3] bg-white px-4 py-2.5 text-sm font-medium text-[#344054] shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
        >
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${ACCENT}18`, color: ACCENT }}
          >
            <ShieldCheck size={16} />
          </span>
          {pagination.total} total
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#ECEFF3] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex flex-col gap-3 border-b border-[#F2F4F7] px-5 py-4 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, or phone"
              className="h-10 w-full rounded-lg border border-[#D0D5DD] bg-white pl-9 pr-3 text-sm text-[#101828] outline-none placeholder:text-[#98A2B3] focus:border-[#021A54] focus:ring-1 focus:ring-[#021A54]"
            />
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-10 rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none focus:border-[#021A54] focus:ring-1 focus:ring-[#021A54]"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#F9FAFB] text-[12px] font-semibold uppercase tracking-[0.04em] text-[#667085]">
              <tr>
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-5 py-3 font-semibold">Phone</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Last login</th>
                <th className="px-5 py-3 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-[#667085]">
                    Loading super admins…
                  </td>
                </tr>
              ) : admins.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-[#667085]">
                    No super admins found.
                  </td>
                </tr>
              ) : (
                admins.map((admin) => (
                  <tr key={admin._id} className="border-t border-[#F2F4F7]">
                    <td className="px-5 py-4 align-top">
                      <p className="font-semibold text-[#101828]">{displayName(admin)}</p>
                      <p className="mt-0.5 text-[13px] text-[#667085]">{admin.email || '—'}</p>
                    </td>
                    <td className="px-5 py-4 align-top text-[#344054]">
                      {admin.phone || '—'}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-medium ${
                          admin.isActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {admin.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-top text-[#344054]">
                      {formatDateTime(admin.lastLogin)}
                    </td>
                    <td className="px-5 py-4 align-top text-[#344054]">
                      {formatDate(admin.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-[#F2F4F7] px-5 py-3">
          <p className="text-[13px] text-[#667085]">
            Page {pagination.page} of {totalPages} · {pagination.total} total
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1 || loading}
              onClick={() => loadAdmins(pagination.page - 1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D0D5DD] text-[#344054] disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              disabled={pagination.page >= totalPages || loading}
              onClick={() => loadAdmins(pagination.page + 1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D0D5DD] text-[#344054] disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
