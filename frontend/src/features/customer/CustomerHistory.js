'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { loyaltyService } from '@/services/loyalty.service';
import { getErrorMessage } from '@/utils';
import { customerCardClass, relativeTime } from '@/features/customer/customerTheme';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'stamp', label: 'Stamps' },
  { id: 'redeem', label: 'Redeemed' },
];

function formatWhen(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function EventIcon({ type }) {
  if (type === 'redeem') {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-sm">
        ⭐
      </span>
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-sm font-bold text-[#1D4ED8]">
      ✓
    </span>
  );
}

export function CustomerHistory() {
  const [shops, setShops] = useState([]);
  const [summary, setSummary] = useState({ shopCount: 0, stampCount: 0, redeemCount: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await loyaltyService.listHistory();
      setShops(data.data?.shops || []);
      setSummary(
        data.data?.summary || { shopCount: 0, stampCount: 0, redeemCount: 0 }
      );
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to load history'));
      setShops([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visibleShops = useMemo(() => {
    if (filter === 'all') return shops;
    return shops
      .map((shop) => ({
        ...shop,
        events: (shop.events || []).filter((event) => event.type === filter),
      }))
      .filter((shop) => (shop.events || []).length > 0);
  }, [shops, filter]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm font-semibold text-[#64748B]">
        Loading history…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-[#021A54] lg:text-3xl">
          History
        </h1>
        <p className="mt-2 text-[13px] text-[#64748B]">
          Shop-wise stamps collected and offers redeemed.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Shops', value: summary.shopCount },
          { label: 'Stamps', value: summary.stampCount },
          { label: 'Redeemed', value: summary.redeemCount },
        ].map((item) => (
          <div key={item.label} className={customerCardClass('px-3 py-3 text-center')}>
            <p className="text-xl font-extrabold text-[#021A54]">{item.value}</p>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
              {item.label}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => {
          const active = filter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition ${
                active
                  ? 'bg-[#021A54] text-white'
                  : 'bg-white text-[#64748B] shadow-[0_2px_8px_rgba(2,26,84,0.06)]'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {!visibleShops.length ? (
        <div className={customerCardClass('px-5 py-10 text-center')}>
          <p className="text-sm font-bold text-[#0F172A]">No activity yet</p>
          <p className="mt-1.5 text-[13px] text-[#64748B]">
            Collect a stamp or redeem an offer to start your history.
          </p>
          <Link
            href="/app"
            className="mt-4 inline-flex rounded-xl bg-[#021A54] px-4 py-2.5 text-sm font-bold text-white"
          >
            Open my cards
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {visibleShops.map((shop) => (
            <section key={shop.membershipId || shop.slug} className={customerCardClass('overflow-hidden')}>
              <div className="flex items-center justify-between gap-3 border-b border-[#F1F5F9] px-4 py-3.5">
                <Link href={`/app/cards/${shop.slug}`} className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#021A54] text-sm font-bold text-white">
                    {shop.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-[#0F172A]">{shop.name}</p>
                    <p className="text-[11.5px] text-[#94A3B8]">
                      {shop.stampCount} stamp{shop.stampCount === 1 ? '' : 's'} · {shop.redeemCount}{' '}
                      redeemed
                      {shop.lastActivityAt ? ` · ${relativeTime(shop.lastActivityAt)}` : ''}
                    </p>
                  </div>
                </Link>
                <Link
                  href={`/app/cards/${shop.slug}`}
                  className="shrink-0 text-[12px] font-bold text-[#3B82F6] hover:underline"
                >
                  Card
                </Link>
              </div>

              <ul className="divide-y divide-[#F8FAFC]">
                {(shop.events || []).map((event) => (
                  <li key={event.id} className="flex items-start gap-3 px-4 py-3.5">
                    <EventIcon type={event.type} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-[#0F172A]">{event.offerTitle}</p>
                      <p className="mt-0.5 text-[12px] text-[#64748B]">{event.label}</p>
                      {event.source === 'bill' || event.source === 'request' ? (
                        <p className="mt-1 text-[11px] font-semibold text-[#94A3B8]">
                          {event.source === 'request' ? 'Stamp request' : 'Bill photo'}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[12px] font-semibold text-[#344054]">
                        {formatWhen(event.at)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#94A3B8]">{relativeTime(event.at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
