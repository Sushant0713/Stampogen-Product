'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Search, ZoomIn, ZoomOut, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn, getErrorMessage } from '@/utils';
import { loyaltyService } from '@/services/loyalty.service';

const POLL_MS = 5000;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

function formatBillDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function initialsOf(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function CountBadge({ count, selected }) {
  if (!count) return null;
  return (
    <span
      className={cn(
        'ml-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-extrabold leading-none',
        selected ? 'bg-white/20 text-white' : 'bg-[#021A54] text-white'
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

function BillImageLightbox({ bill, onClose }) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);
  const pinchRef = useRef(null);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const clampZoom = (value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

  const resetView = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const zoomBy = (delta) => {
    setZoom((prev) => {
      const next = clampZoom(Number((prev + delta).toFixed(2)));
      if (next <= 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const onWheel = (event) => {
    event.preventDefault();
    zoomBy(event.deltaY > 0 ? -0.2 : 0.2);
  };

  const onPointerDown = (event) => {
    if (zoom <= 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
  };

  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || zoom <= 1) return;
    setOffset({
      x: drag.originX + (event.clientX - drag.startX),
      y: drag.originY + (event.clientY - drag.startY),
    });
  };

  const onPointerUp = (event) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  };

  const onTouchStart = (event) => {
    if (event.touches.length === 2) {
      const [a, b] = event.touches;
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      pinchRef.current = { distance, zoom };
      dragRef.current = null;
    }
  };

  const onTouchMove = (event) => {
    if (event.touches.length === 2 && pinchRef.current) {
      event.preventDefault();
      const [a, b] = event.touches;
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const ratio = distance / Math.max(1, pinchRef.current.distance);
      const next = clampZoom(pinchRef.current.zoom * ratio);
      setZoom(next);
      if (next <= 1) setOffset({ x: 0, y: 0 });
    }
  };

  const onTouchEnd = () => {
    if (!pinchRef.current) return;
    pinchRef.current = null;
  };

  const onDoubleClick = () => {
    if (zoom > 1) {
      resetView();
      return;
    }
    setZoom(2.5);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label="Bill photo preview"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between gap-2 px-4 py-3 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {bill.offerTitle || bill.documentName || 'Bill photo'}
          </p>
          {formatBillDateTime(bill.stampedAt) ? (
            <p className="mt-0.5 text-[11px] font-medium text-white/70">
              {formatBillDateTime(bill.stampedAt)}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => zoomBy(-0.5)}
            disabled={zoom <= MIN_ZOOM}
            className="rounded-full bg-white/15 p-2 disabled:opacity-40"
            aria-label="Zoom out"
          >
            <ZoomOut size={18} />
          </button>
          <button
            type="button"
            onClick={() => zoomBy(0.5)}
            disabled={zoom >= MAX_ZOOM}
            className="rounded-full bg-white/15 p-2 disabled:opacity-40"
            aria-label="Zoom in"
          >
            <ZoomIn size={18} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/15 p-2"
            aria-label="Close preview"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div
        className="relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bill.document}
          alt={bill.documentName || 'Bill'}
          draggable={false}
          onDoubleClick={onDoubleClick}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={cn(
            'max-h-full max-w-full select-none object-contain transition-transform duration-150',
            zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'
          )}
          style={{
            transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
        />
      </div>

      <p className="px-4 py-3 text-center text-[11px] text-white/70" onClick={(e) => e.stopPropagation()}>
        Pinch or use +/− to zoom · Double-tap to zoom · Drag when zoomed
      </p>
    </div>
  );
}

export function AdminRewards() {
  const [stampMode, setStampMode] = useState('bill');
  const [activeFilter, setActiveFilter] = useState('requests');
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [previewBill, setPreviewBill] = useState(null);
  const [counts, setCounts] = useState({
    requests: 0,
    pending: 0,
    redeemed: 0,
  });

  useEffect(() => {
    loyaltyService
      .adminGetSettings()
      .then(({ data }) => {
        const mode = data.data?.settings?.loyaltyStampMode || 'bill';
        setStampMode(mode);
        setActiveFilter(mode === 'request' ? 'requests' : 'pending');
      })
      .catch(() => {});
  }, []);

  const loadCounts = useCallback(async () => {
    try {
      const { data } = await loyaltyService.adminStats();
      const stats = data.data?.stats || {};
      setCounts({
        requests: Number(stats.pendingStampRequests) || 0,
        pending: Number(stats.pendingRewards) || 0,
        redeemed: Number(stats.redeemedRewards) || 0,
      });
    } catch {
      // Keep previous counts
    }
  }, []);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent) setLoading(true);
        if (activeFilter === 'requests') {
          const { data } = await loyaltyService.adminListStampRequests();
          setCustomers(data.data.requests || []);
        } else {
          const { data } = await loyaltyService.adminListRewards(activeFilter);
          setCustomers(data.data.rewards || []);
        }
        await loadCounts();
      } catch (error) {
        if (!silent) toast.error(getErrorMessage(error, 'Unable to load rewards'));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [activeFilter, loadCounts]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => load({ silent: true }), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const onResolved = () => load({ silent: true });
    window.addEventListener('stampogen:stamp-request-resolved', onResolved);
    return () => window.removeEventListener('stampogen:stamp-request-resolved', onResolved);
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      const phoneNorm = String(c.phone || '').replace(/\s/g, '');
      const qNorm = q.replace(/\s/g, '');
      return (
        !q ||
        c.name.toLowerCase().includes(q) ||
        phoneNorm.includes(qNorm) ||
        String(c.email || '').toLowerCase().includes(q) ||
        String(c.offer || '').toLowerCase().includes(q) ||
        String(c.reward || '').toLowerCase().includes(q)
      );
    });
  }, [customers, search]);

  const approveRequest = async (id) => {
    const row = customers.find((c) => c.id === id);
    try {
      setBusyId(id);
      const { data } = await loyaltyService.adminApproveStampRequest(id);
      toast.success(data.message || `Stamp approved for ${row?.name || 'customer'}`);
      await load({ silent: true });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to approve'));
    } finally {
      setBusyId('');
    }
  };

  const rejectRequest = async (id) => {
    const row = customers.find((c) => c.id === id);
    try {
      setBusyId(id);
      await loyaltyService.adminRejectStampRequest(id);
      toast.success(`Request rejected for ${row?.name || 'customer'}`);
      await load({ silent: true });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to reject'));
    } finally {
      setBusyId('');
    }
  };

  const openVerify = async (id) => {
    try {
      setReviewLoading(true);
      setBusyId(id);
      const { data } = await loyaltyService.adminGetReward(id);
      setReview(data.data.reward);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to load reward details'));
    } finally {
      setReviewLoading(false);
      setBusyId('');
    }
  };

  const confirmVerify = async () => {
    if (!review?.id) return;
    try {
      setBusyId(review.id);
      const { data } = await loyaltyService.adminVerify(review.id);
      setReview(data.data.reward);
      toast.success(stampMode === 'request' ? 'Reward confirmed' : 'Bills verified');
      await load({ silent: true });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to verify'));
    } finally {
      setBusyId('');
    }
  };

  const cancelReward = async () => {
    if (!review?.id) return;
    try {
      setBusyId(review.id);
      await loyaltyService.adminCancel(review.id);
      toast.success('Request cancelled — stamps reset');
      setReview(null);
      await load({ silent: true });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to cancel'));
    } finally {
      setBusyId('');
    }
  };

  const giveReward = async (id) => {
    const row = customers.find((c) => c.id === id);
    const canGiveDirect =
      stampMode === 'request' && (row?.rewardStatus === 'pending' || row?.verified);
    if (!row?.verified && row?.rewardStatus !== 'verified' && !canGiveDirect) {
      toast.error(stampMode === 'request' ? 'Confirm the reward first' : 'Verify bills first');
      return;
    }
    try {
      setBusyId(id);
      await loyaltyService.adminGive(id);
      toast.success(`Reward given to ${row.name}`);
      if (review?.id === id) setReview(null);
      await load({ silent: true });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to give reward'));
    } finally {
      setBusyId('');
    }
  };

  const subtitle =
    activeFilter === 'requests'
      ? 'Customers requesting a stamp after their visit — approve or reject each request.'
      : stampMode === 'request'
        ? 'Customers who completed all stamps — confirm and give their reward.'
        : 'Customers who finished all stamps — verify bill photos, then give the reward.';

  const emptyMessage =
    activeFilter === 'requests'
      ? 'No stamp requests waiting for approval.'
      : activeFilter === 'pending'
        ? 'No customers waiting for reward verification yet.'
        : 'No redeemed rewards yet.';

  const filters = [
    { id: 'requests', label: 'Stamp requests', count: counts.requests, showCount: true },
    { id: 'pending', label: 'Rewards', count: counts.pending, showCount: true },
    { id: 'redeemed', label: 'Redeemed', count: counts.redeemed, showCount: false },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 lg:max-w-2xl">
      <div className="flex flex-col gap-3.5">
        <div>
          <h1 className="text-2xl font-extrabold text-[#021A54]">Rewards</h1>
          <p className="mt-1.5 text-[13px] font-medium text-[#64748B]">{subtitle}</p>
        </div>

        <label className="flex items-center gap-2.5 rounded-[14px] bg-white px-3.5 py-3 shadow-[0_6px_16px_rgba(2,26,84,0.06)]">
          <Search size={16} className="shrink-0 text-[#94A3B8]" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email or phone"
            className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-[#021A54] outline-none placeholder:text-[#94A3B8]"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {filters.map((f) => {
            const selected = activeFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFilter(f.id)}
                className={cn(
                  'inline-flex items-center rounded-xl px-4 py-2 text-[12.5px] font-bold transition active:scale-95',
                  selected
                    ? 'bg-[#021A54] text-white shadow-[0_4px_12px_rgba(2,26,84,0.2)]'
                    : 'bg-white text-[#64748B] shadow-[0_4px_12px_rgba(2,26,84,0.06)]'
                )}
              >
                {f.label}
                {f.showCount ? <CountBadge count={f.count} selected={selected} /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {loading ? (
          <p className="rounded-[14px] bg-white px-4 py-10 text-center text-sm text-[#64748B] shadow-[0_6px_16px_rgba(2,26,84,0.05)]">
            Loading…
          </p>
        ) : visible.length === 0 ? (
          <p className="rounded-[14px] bg-white px-4 py-10 text-center text-sm text-[#64748B] shadow-[0_6px_16px_rgba(2,26,84,0.05)]">
            {emptyMessage}
          </p>
        ) : activeFilter === 'requests' ? (
          visible.map((cu) => (
            <div
              key={cu.id}
              className="flex items-center gap-2.5 rounded-[14px] bg-white px-3 py-2.5 shadow-[0_6px_16px_rgba(2,26,84,0.05)]"
            >
              <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#021A54] text-xs font-extrabold text-white">
                {initialsOf(cu.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-bold text-[#021A54]">{cu.name}</p>
                <p className="truncate text-[11px] font-bold text-[#475569]">
                  {cu.offer} · {cu.reward}
                </p>
                <p className="truncate text-[10px] font-medium text-[#94A3B8]">
                  Will become {cu.progressAfterApprove}
                  {cu.phone ? ` · ${cu.phone}` : cu.email ? ` · ${cu.email}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  disabled={busyId === cu.id}
                  onClick={() => rejectRequest(cu.id)}
                  className="whitespace-nowrap rounded-[9px] border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-2 text-[10.5px] font-bold text-[#DC2626] disabled:opacity-60"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={busyId === cu.id}
                  onClick={() => approveRequest(cu.id)}
                  className="whitespace-nowrap rounded-[9px] bg-gradient-to-br from-[#021A54] to-[#3B82F6] px-2.5 py-2 text-[10.5px] font-bold text-white disabled:opacity-60"
                >
                  Approve
                </button>
              </div>
            </div>
          ))
        ) : (
          visible.map((cu) => (
            <div
              key={cu.id}
              className="flex items-center gap-2.5 rounded-[14px] bg-white px-3 py-2.5 shadow-[0_6px_16px_rgba(2,26,84,0.05)]"
            >
              <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#021A54] text-xs font-extrabold text-white">
                {initialsOf(cu.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-bold text-[#021A54]">{cu.name}</p>
                <p className="truncate text-[11px] font-bold text-[#475569]">
                  {cu.offer} · {cu.reward}
                </p>
                <p className="truncate text-[10px] font-medium text-[#94A3B8]">
                  {cu.stamps}/{cu.stampsRequired} stamps
                  {cu.phone ? ` · ${cu.phone}` : cu.email ? ` · ${cu.email}` : ''}
                </p>
              </div>

              {cu.redeemed ? (
                <div className="flex shrink-0 items-center gap-1 rounded-[9px] bg-[rgba(34,197,94,0.1)] px-2.5 py-1.5 text-[10px] font-bold text-[#22C55E]">
                  <Check size={10} strokeWidth={3} />
                  Given
                </div>
              ) : (
                <div className="flex shrink-0 gap-1.5">
                  {stampMode === 'bill' ? (
                    <button
                      type="button"
                      disabled={busyId === cu.id}
                      onClick={() => openVerify(cu.id)}
                      className={cn(
                        'whitespace-nowrap rounded-[9px] border px-2.5 py-2 text-[10.5px] font-bold active:scale-95 disabled:opacity-60',
                        cu.verified
                          ? 'border-transparent bg-[rgba(59,130,246,0.1)] text-[#3B82F6]'
                          : 'border-[#E2E8F0] bg-white text-[#64748B]'
                      )}
                    >
                      {cu.verified ? 'Verified' : 'Verify'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId === cu.id}
                      onClick={() => openVerify(cu.id)}
                      className="whitespace-nowrap rounded-[9px] border border-[#E2E8F0] bg-white px-2.5 py-2 text-[10.5px] font-bold text-[#64748B] disabled:opacity-60"
                    >
                      {cu.verified ? 'Confirmed' : 'Confirm'}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={
                      busyId === cu.id ||
                      (stampMode === 'bill' && !cu.verified && cu.rewardStatus !== 'verified')
                    }
                    onClick={() => giveReward(cu.id)}
                    className="whitespace-nowrap rounded-[9px] bg-gradient-to-br from-[#021A54] to-[#3B82F6] px-2.5 py-2 text-[10.5px] font-bold text-white shadow-[0_6px_14px_rgba(2,26,84,0.2)] active:scale-95 disabled:opacity-50"
                  >
                    Give
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {(review || reviewLoading) && activeFilter !== 'requests' && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-[rgba(2,26,84,0.55)] p-4 backdrop-blur-sm sm:items-center"
          onClick={() => !busyId && setReview(null)}
          role="presentation"
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-[0_30px_60px_rgba(0,0,0,0.35)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="verify-reward-title"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="verify-reward-title" className="text-lg font-extrabold text-[#021A54]">
                  {stampMode === 'request' ? 'Confirm reward' : 'Verify bill photos'}
                </h2>
                {review ? (
                  <p className="mt-1 text-[13px] text-[#64748B]">
                    {review.name} · {review.reward}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setReview(null)}
                className="rounded-full bg-[#F1F5F9] p-2 text-[#64748B]"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {reviewLoading || !review ? (
              <p className="py-10 text-center text-sm text-[#64748B]">Loading…</p>
            ) : (
              <>
                {stampMode === 'bill' ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {(review.bills || []).length === 0 ? (
                      <p className="col-span-full py-6 text-center text-sm text-[#64748B]">
                        No bill photos found.
                      </p>
                    ) : (
                      review.bills.map((bill) => {
                        const stampedLabel = formatBillDateTime(bill.stampedAt);
                        return (
                          <button
                            key={bill.id}
                            type="button"
                            onClick={() => setPreviewBill(bill)}
                            className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] text-left transition hover:border-[#021A54]/40"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={bill.document}
                              alt={bill.documentName || 'Bill'}
                              className="aspect-square w-full object-cover"
                            />
                            <div className="space-y-0.5 px-2 py-1.5">
                              <p className="truncate text-[10px] font-semibold text-[#64748B]">
                                {bill.offerTitle || 'Stamp'}
                              </p>
                              {stampedLabel ? (
                                <p className="truncate text-[10px] font-bold text-[#021A54]">
                                  {stampedLabel}
                                </p>
                              ) : null}
                              <p className="text-[9px] font-medium text-[#94A3B8]">Tap to zoom</p>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <p className="rounded-2xl bg-[#F8FAFC] px-4 py-6 text-center text-sm text-[#64748B]">
                    This shop uses stamp requests — no bill photos. Confirm the customer completed
                    this offer, then give the reward.
                  </p>
                )}

                <div className="mt-5 flex flex-col gap-2.5">
                  {review.rewardStatus !== 'verified' ? (
                    <button
                      type="button"
                      disabled={Boolean(busyId)}
                      onClick={confirmVerify}
                      className="rounded-2xl bg-[#3B82F6] py-3.5 text-sm font-bold text-white disabled:opacity-60"
                    >
                      {stampMode === 'request' ? 'Confirm reward' : 'Verify bills'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={Boolean(busyId)}
                      onClick={() => giveReward(review.id)}
                      className="rounded-2xl bg-gradient-to-br from-[#021A54] to-[#3B82F6] py-3.5 text-sm font-bold text-white disabled:opacity-60"
                    >
                      Give reward
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={Boolean(busyId)}
                    onClick={cancelReward}
                    className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] py-3.5 text-sm font-bold text-[#DC2626] disabled:opacity-60"
                  >
                    Cancel request
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {previewBill ? (
        <BillImageLightbox bill={previewBill} onClose={() => setPreviewBill(null)} />
      ) : null}
    </div>
  );
}
