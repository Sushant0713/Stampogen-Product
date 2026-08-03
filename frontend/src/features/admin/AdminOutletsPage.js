'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Loader2, Plus, Store } from 'lucide-react';
import { outletService } from '@/services/outlet.service';
import { getErrorMessage } from '@/utils';
import { AdminPageHeader } from '@/features/admin/AdminPageShell';
import { ADMIN_ACCENT, adminCardClass } from '@/features/admin/adminTheme';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const emptyForm = {
  name: '',
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  seatId: '',
};

export function AdminOutletsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const seatJustPurchased = searchParams.get('seat') === '1';
  const justRenewed = searchParams.get('renewed') === '1';
  const seatPromptDone = useRef(false);
  const renewToastDone = useRef(false);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data: res } = await outletService.dashboard();
      setData(res.data || null);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to load outlets'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unusedSeats = (data?.seats?.items || []).filter((s) => s.active && !s.used);
  const expiredOutlets = data?.expiredOutlets || (data?.outlets || []).filter((o) => o.expired);

  // Stable Seat 1, 2, 3… by purchase order (oldest first).
  const seatNumberById = useMemo(() => {
    const items = [...(data?.seats?.items || [])].sort(
      (a, b) =>
        new Date(a.purchasedAt || 0).getTime() - new Date(b.purchasedAt || 0).getTime()
    );
    const map = new Map();
    items.forEach((seat, index) => {
      map.set(String(seat.id), index + 1);
    });
    return map;
  }, [data?.seats?.items]);

  const numberedUnusedSeats = useMemo(
    () =>
      unusedSeats.map((seat) => ({
        ...seat,
        seatNumber: seatNumberById.get(String(seat.id)) || 0,
      })),
    [unusedSeats, seatNumberById]
  );

  // After checkout: open Add outlet and clear the query so refresh doesn't re-toast.
  useEffect(() => {
    if (!seatJustPurchased || loading || seatPromptDone.current || !data) return;
    seatPromptDone.current = true;
    if (data.canAddOutlet && unusedSeats.length) {
      setShowForm(true);
      setForm((prev) => ({
        ...prev,
        seatId: unusedSeats[0]._id || unusedSeats[0].id || '',
      }));
    } else if (!data.canAddOutlet) {
      toast.error('Seat not found yet. Buy an outlet plan, or refresh in a moment.');
    }
    router.replace('/admin/outlets', { scroll: false });
  }, [seatJustPurchased, loading, data, unusedSeats, router]);

  useEffect(() => {
    if (!justRenewed || renewToastDone.current) return;
    renewToastDone.current = true;
    toast.success('Outlet plan updated');
    router.replace('/admin/outlets', { scroll: false });
  }, [justRenewed, router]);

  const renewHref = (outlet) => {
    if (outlet.planCode) {
      const params = new URLSearchParams({
        plan: outlet.planCode,
        renewOutlet: outlet.id,
      });
      return `/checkout?${params.toString()}`;
    }
    return `/admin/plans/outlet/browse?renewOutlet=${encodeURIComponent(outlet.id)}`;
  };

  const changeHref = (outlet) =>
    `/admin/plans/outlet/browse?renewOutlet=${encodeURIComponent(outlet.id)}`;

  const handleCreate = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      await outletService.create({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        seatId: form.seatId || undefined,
      });
      toast.success('Outlet created');
      setForm(emptyForm);
      setShowForm(false);
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to create outlet'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-[#667085]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading outlets…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl lg:max-w-none">
      <AdminPageHeader
        title="My outlets"
        subtitle="Buy an outlet plan seat, then create a separate login for each outlet."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Outlets', value: data?.outlets?.length || 0 },
          { label: 'Active seats', value: data?.seats?.active || 0 },
          { label: 'Unused seats', value: data?.seats?.unused || 0 },
        ].map((item) => (
          <div key={item.label} className={adminCardClass('px-4 py-3 text-center')}>
            <p className="text-2xl font-extrabold text-[#021A54]">{item.value}</p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#94A3B8]">
              {item.label}
            </p>
          </div>
        ))}
      </div>

      {expiredOutlets.length > 0 ? (
        <div className="mb-5 space-y-3">
          {expiredOutlets.map((outlet) => (
            <div
              key={`expired-${outlet.id}`}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950"
            >
              <p className="font-bold">
                {outlet.name} plan has ended
                {outlet.planName ? ` (${outlet.planName})` : ''}
              </p>
              <p className="mt-1 text-[13px] text-red-900/80">
                Ended {formatDate(outlet.planEndsAt)}. That outlet login stays locked until you
                renew or change its plan.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={renewHref(outlet)}
                  className="inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-bold text-white"
                  style={{ backgroundColor: ADMIN_ACCENT }}
                >
                  Renew plan
                </Link>
                <Link
                  href={changeHref(outlet)}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-red-200 bg-white px-4 text-sm font-bold text-[#344054]"
                >
                  Change plan
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {unusedSeats.length > 0 ? (
        <div
          className="mb-5 rounded-xl border px-4 py-3 text-sm text-[#344054]"
          style={{ borderColor: '#FEC84B', backgroundColor: '#FFFAEB' }}
        >
          You have <strong>{unusedSeats.length}</strong> unused seat
          {unusedSeats.length === 1 ? '' : 's'}. Use <strong>Add outlet</strong> to create a
          separate login.
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap gap-3">
        <Link
          href="/admin/plans/outlet/browse"
          className="inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-bold text-white"
          style={{ backgroundColor: ADMIN_ACCENT }}
        >
          Browse outlet plans
        </Link>
        <button
          type="button"
          disabled={!data?.canAddOutlet}
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#D0D5DD] bg-white px-4 text-sm font-bold text-[#344054] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={16} />
          Add outlet
        </button>
      </div>

      {!data?.canAddOutlet ? (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          No unused outlet seats. Buy an outlet plan first, then add an outlet.
        </div>
      ) : null}

      {showForm ? (
        <form onSubmit={handleCreate} className={adminCardClass('mb-5 space-y-4 p-5')}>
          <h2 className="text-base font-extrabold text-[#101828]">Create outlet login</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-[#344054]">Outlet name</span>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="h-11 w-full rounded-lg border border-[#D0D5DD] px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-[#344054]">Login email</span>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="h-11 w-full rounded-lg border border-[#D0D5DD] px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-[#344054]">Password</span>
              <input
                required
                type="password"
                minLength={8}
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className="h-11 w-full rounded-lg border border-[#D0D5DD] px-3"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-semibold text-[#344054]">
                Which outlet seat to use
              </span>
              <select
                value={form.seatId}
                onChange={(e) => setForm((p) => ({ ...p, seatId: e.target.value }))}
                className="h-11 w-full rounded-lg border border-[#D0D5DD] px-3"
              >
                <option value="">
                  Auto — next free seat
                  {numberedUnusedSeats[0]?.seatNumber
                    ? ` (Seat ${numberedUnusedSeats[0].seatNumber})`
                    : ''}
                </option>
                {numberedUnusedSeats.map((seat) => (
                  <option key={seat.id} value={seat.id}>
                    Seat {seat.seatNumber} — {seat.planName || 'Outlet plan'} · ends{' '}
                    {formatDate(seat.endsAt)}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[12px] leading-relaxed text-[#667085]">
                Each outlet plan purchase gives you 1 seat. Creating this outlet uses one unused
                seat. “Auto — next free seat” picks the first unused active seat for you.
              </p>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-[#344054]">Manager first name</span>
              <input
                value={form.firstName}
                onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                className="h-11 w-full rounded-lg border border-[#D0D5DD] px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-[#344054]">Manager last name</span>
              <input
                value={form.lastName}
                onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                className="h-11 w-full rounded-lg border border-[#D0D5DD] px-3"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-11 items-center rounded-xl px-5 text-sm font-bold text-white disabled:opacity-60"
            style={{ backgroundColor: ADMIN_ACCENT }}
          >
            {saving ? 'Creating…' : 'Create outlet'}
          </button>
        </form>
      ) : null}

      <div className={adminCardClass('overflow-hidden')}>
        <div className="border-b border-[#F1F5F9] px-4 py-3">
          <h2 className="text-sm font-extrabold text-[#101828]">Your outlets</h2>
        </div>
        {!data?.outlets?.length ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-sm text-[#667085]">
            <Store size={28} className="text-[#98A2B3]" />
            No outlets yet.
          </div>
        ) : (
          <ul className="divide-y divide-[#F8FAFC]">
            {data.outlets.map((outlet) => (
              <li key={outlet.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                <div>
                  <p className="text-sm font-bold text-[#0F172A]">{outlet.name}</p>
                  <p className="text-[12px] text-[#94A3B8]">
                    {outlet.ownerEmail} · /{outlet.slug}
                    {outlet.planName ? ` · ${outlet.planName}` : ''}
                    {outlet.planEndsAt ? ` · ends ${formatDate(outlet.planEndsAt)}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {outlet.expired ? (
                    <>
                      <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-800">
                        Plan ended
                      </span>
                      <Link
                        href={renewHref(outlet)}
                        className="rounded-lg bg-[#021A54] px-3 py-1.5 text-[12px] font-bold text-white"
                      >
                        Renew
                      </Link>
                      <Link
                        href={changeHref(outlet)}
                        className="rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-[12px] font-bold text-[#344054]"
                      >
                        Change plan
                      </Link>
                    </>
                  ) : (
                    <p className="text-[12px] text-[#667085]">Created {formatDate(outlet.createdAt)}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={`${adminCardClass('mt-5 overflow-hidden')}`}>
        <div className="border-b border-[#F1F5F9] px-4 py-3">
          <h2 className="text-sm font-extrabold text-[#101828]">Outlet seats</h2>
        </div>
        {!data?.seats?.items?.length ? (
          <p className="px-4 py-8 text-center text-sm text-[#667085]">No outlet seats purchased yet.</p>
        ) : (
          <ul className="divide-y divide-[#F8FAFC]">
            {data.seats.items.map((seat) => {
              const seatNumber = seatNumberById.get(String(seat.id));
              return (
              <li key={seat.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                <div>
                  <p className="text-sm font-bold text-[#0F172A]">
                    {seatNumber ? `Seat ${seatNumber} — ` : ''}
                    {seat.planName || 'Outlet plan'}
                  </p>
                  <p className="text-[12px] text-[#94A3B8]">
                    {seat.billing} · ends {formatDate(seat.endsAt)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    !seat.active
                      ? 'bg-red-50 text-red-700'
                      : seat.used
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-amber-50 text-amber-900'
                  }`}
                >
                  {!seat.active ? 'Expired' : seat.used ? 'In use' : 'Unused'}
                </span>
              </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
