'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { affiliateSettingsService } from '@/services/affiliateSettings.service';
import { AFFILIATE_TYPE_OPTIONS } from '@/constants/affiliateTypes';
import { getErrorMessage } from '@/utils';

const ACCENT = '#021A54';

const inputClass =
  'h-10 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none focus:border-[#021A54] focus:ring-1 focus:ring-[#021A54]';

function emptyTypes() {
  return Object.fromEntries(
    AFFILIATE_TYPE_OPTIONS.map((opt) => [
      opt.value,
      {
        enabled: true,
        defaultDiscountPercent: 20,
        earningPercent: 20,
        minimumTargetValue: 0,
        label: opt.label,
        value: opt.value,
      },
    ])
  );
}

function mapTypeRow(opt, row) {
  return {
    enabled: row.enabled !== false,
    defaultDiscountPercent: Number(row.defaultDiscountPercent) || 0,
    earningPercent:
      row.earningPercent != null
        ? Number(row.earningPercent)
        : Number(row.defaultDiscountPercent) || 20,
    minimumTargetValue: Number(row.minimumTargetValue) || 0,
    label: row.label || opt.label,
    value: opt.value,
  };
}

export function AffiliateSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [types, setTypes] = useState(emptyTypes);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await affiliateSettingsService.get();
      const settings = data?.data?.settings;
      if (!settings) return;
      const next = emptyTypes();
      for (const opt of AFFILIATE_TYPE_OPTIONS) {
        const row = settings.types?.[opt.value];
        if (row) next[opt.value] = mapTypeRow(opt, row);
      }
      setTypes(next);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to load affiliate settings'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateType = (type, patch) => {
    setTypes((prev) => ({
      ...prev,
      [type]: { ...prev[type], ...patch },
    }));
  };

  const handleSave = async () => {
    const enabledCount = AFFILIATE_TYPE_OPTIONS.filter((opt) => types[opt.value]?.enabled)
      .length;
    if (enabledCount < 1) {
      toast.error('Keep at least one affiliate type enabled');
      return;
    }

    for (const opt of AFFILIATE_TYPE_OPTIONS) {
      const row = types[opt.value];
      const discountPct = Number(row.defaultDiscountPercent);
      if (Number.isNaN(discountPct) || discountPct < 0 || discountPct > 100) {
        toast.error(`${opt.label}: partner discount must be 0–100%`);
        return;
      }
      const earningPct = Number(row.earningPercent);
      if (Number.isNaN(earningPct) || earningPct < 0 || earningPct > 100) {
        toast.error(`${opt.label}: earning percent must be 0–100%`);
        return;
      }
      const target = Number(row.minimumTargetValue);
      if (Number.isNaN(target) || target < 0) {
        toast.error(`${opt.label}: minimum target must be 0 or greater`);
        return;
      }
    }

    try {
      setSaving(true);
      const payload = {
        types: Object.fromEntries(
          AFFILIATE_TYPE_OPTIONS.map((opt) => [
            opt.value,
            {
              enabled: Boolean(types[opt.value].enabled),
              defaultDiscountPercent: Number(types[opt.value].defaultDiscountPercent) || 0,
              earningPercent: Number(types[opt.value].earningPercent) || 0,
              minimumTargetValue: Number(types[opt.value].minimumTargetValue) || 0,
            },
          ])
        ),
      };
      const { data } = await affiliateSettingsService.save(payload);
      const saved = data?.data?.settings;
      if (saved) {
        const next = emptyTypes();
        for (const opt of AFFILIATE_TYPE_OPTIONS) {
          const row = saved.types?.[opt.value];
          if (row) next[opt.value] = mapTypeRow(opt, row);
        }
        setTypes(next);
      }
      toast.success('Affiliate settings saved');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to save affiliate settings'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-[#667085]">Loading affiliate settings…</p>;
  }

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        {AFFILIATE_TYPE_OPTIONS.map((opt) => {
          const row = types[opt.value];
          return (
            <div
              key={opt.value}
              className="rounded-2xl border border-[#E5E7EB] bg-white p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-[#101828]">{opt.label}</h3>
                  <p className="mt-0.5 text-[13px] text-[#667085]">
                    {row.enabled
                      ? 'Open for registration'
                      : 'Closed — hidden from new registrations'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={row.enabled}
                  onClick={() => updateType(opt.value, { enabled: !row.enabled })}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
                    row.enabled ? 'bg-[#021A54]' : 'bg-[#D0D5DD]'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                      row.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-[#344054]">
                    Partner discount (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    className={inputClass}
                    value={row.defaultDiscountPercent}
                    disabled={!row.enabled}
                    onChange={(e) =>
                      updateType(opt.value, {
                        defaultDiscountPercent: e.target.value,
                      })
                    }
                  />
                  <p className="mt-1 text-[12px] text-[#667085]">
                    Coupon % given to customers on approve (default 20%)
                  </p>
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-[#344054]">
                    Affiliate earning (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    className={inputClass}
                    value={row.earningPercent}
                    disabled={!row.enabled}
                    onChange={(e) =>
                      updateType(opt.value, {
                        earningPercent: e.target.value,
                      })
                    }
                  />
                  <p className="mt-1 text-[12px] text-[#667085]">
                    % of plan price we credit the affiliate per referred sale (default 20%)
                  </p>
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-[#344054]">
                    Minimum target value (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className={inputClass}
                    value={row.minimumTargetValue}
                    disabled={!row.enabled}
                    onChange={(e) =>
                      updateType(opt.value, {
                        minimumTargetValue: e.target.value,
                      })
                    }
                  />
                  <p className="mt-1 text-[12px] text-[#667085]">
                    Earn this much before Redeem unlocks
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: ACCENT }}
        >
          {saving ? 'Saving…' : 'Save affiliate settings'}
        </button>
      </div>
    </div>
  );
}
