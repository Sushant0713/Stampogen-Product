'use client';

import { useCallback, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
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

export function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

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

  const toggleStatus = async (customer) => {
    const next = customer.status === 'active' ? 'suspended' : 'active';
    try {
      setBusyId(customer.id);
      await loyaltyService.adminUpdateCustomer(customer.id, { status: next });
      toast.success(next === 'suspended' ? `${customer.name} suspended` : `${customer.name} activated`);
      await load({ silent: true });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to update customer'));
    } finally {
      setBusyId('');
    }
  };

  const removeCustomer = async (customer) => {
    const ok = window.confirm(
      `Remove ${customer.name} from your loyalty program? Their stamps and history for your shop will be deleted.`
    );
    if (!ok) return;
    try {
      setBusyId(customer.id);
      await loyaltyService.adminDeleteCustomer(customer.id);
      toast.success(`${customer.name} removed`);
      await load({ silent: true });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to delete customer'));
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl lg:max-w-none">
      <AdminPageHeader
        title="Customers"
        subtitle="Everyone who has joined your loyalty program."
      />
      <div className={adminCardClass('overflow-hidden')}>
        {loading ? (
          <p className="px-4 py-10 text-center text-sm text-[#64748B]">Loading customers…</p>
        ) : customers.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-[#64748B]">
            No customers yet. Share your loyalty QR so people can join.
          </p>
        ) : (
          customers.map((c, i) => {
            const isActive = c.status !== 'suspended';
            return (
              <div
                key={c.id}
                className={cn(
                  'flex items-center justify-between gap-3 px-4 py-3.5',
                  i < customers.length - 1 ? 'border-b border-[#F1F5F9]' : '',
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
                      {c.totalStamps} stamps · {relativeJoined(c.joinedAt)}
                      {c.email ? ` · ${c.email}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
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
    </div>
  );
}
