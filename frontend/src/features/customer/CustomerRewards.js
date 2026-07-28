'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { loyaltyService } from '@/services/loyalty.service';
import { getErrorMessage } from '@/utils';

export function CustomerRewards() {
  const router = useRouter();
  const [rewards, setRewards] = useState([]);
  const [addressShown, setAddressShown] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await loyaltyService.listRewards();
      setRewards(data.data.rewards || []);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to load rewards'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm font-semibold text-[#64748B]">
        Loading rewards…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-[#021A54] lg:text-3xl">
          Available Rewards
        </h1>
        <p className="mt-2 text-[13px] text-[#64748B]">
          All the rewards you&apos;re currently working towards.
        </p>
      </div>

      {!rewards.length ? (
        <p className="text-sm text-[#64748B]">Join a shop to start earning rewards.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rewards.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => router.push(`/app/cards/${r.slug}`)}
              className="rounded-[20px] p-4 text-left text-white shadow-[0_8px_20px_rgba(2,26,84,0.1)] transition hover:scale-[1.01] hover:shadow-[0_12px_26px_rgba(2,26,84,0.25)]"
              style={{ background: r.gradient }}
            >
              <div className="mb-2.5 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold">{r.title}</div>
                  <div className="mt-0.5 text-xs text-white/70">{r.shopName}</div>
                </div>
                <span className="shrink-0 rounded-[100px] bg-white/22 px-3 py-1.5 text-[11.5px] font-semibold">
                  {r.requirement}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                {addressShown[r.id] && r.address ? (
                  <span className="text-[11.5px] text-white/85">{r.address}</span>
                ) : (
                  <span className="text-[11.5px] text-white/70">
                    {r.stamps} / {r.stampsRequired} stamps
                  </span>
                )}
                <span
                  role="presentation"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAddressShown((prev) => ({ ...prev, [r.id]: !prev[r.id] }));
                  }}
                  className="ml-auto shrink-0 cursor-pointer rounded-[100px] border border-white/30 bg-white/16 px-3 py-1.5 text-[11.5px] font-semibold hover:bg-white/26"
                >
                  {addressShown[r.id] ? 'Hide' : 'View Address'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
