'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { platformTrialSettingsService } from '@/services/platformTrialSettings.service';
import { planService } from '@/services/plan.service';
import { getErrorMessage } from '@/utils';

const ACCENT = '#021A54';

const inputClass =
  'h-10 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none focus:border-[#021A54] focus:ring-1 focus:ring-[#021A54]';

export function PlatformTrialSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState({
    enabled: false,
    applyOnPublicSignup: false,
    trialDays: 14,
    planId: '',
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [settingsRes, plansRes] = await Promise.all([
        platformTrialSettingsService.get(),
        planService.getAll({ limit: 200, lite: true }),
      ]);
      const settings = settingsRes.data?.data?.settings;
      const assignable = (plansRes.data?.data?.plans || []).filter(
        (plan) =>
          plan.enabled !== false &&
          plan.status !== 'Inactive' &&
          !plan.priceCustom &&
          plan.visibleSuperAdmin !== false
      );
      setPlans(assignable);
      if (settings) {
        setForm({
          enabled: Boolean(settings.enabled),
          applyOnPublicSignup: Boolean(settings.applyOnPublicSignup),
          trialDays: Math.max(1, Number(settings.trialDays) || 14),
          planId: settings.planId || settings.plan?.id || '',
        });
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to load free trial settings'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    const days = Number(form.trialDays);
    if (!Number.isFinite(days) || days < 1 || days > 3650) {
      toast.error('Trial days must be between 1 and 3650');
      return;
    }
    if ((form.enabled || form.applyOnPublicSignup) && !form.planId) {
      toast.error('Select a plan for the free trial');
      return;
    }

    try {
      setSaving(true);
      await platformTrialSettingsService.save({
        enabled: Boolean(form.enabled),
        applyOnPublicSignup: Boolean(form.enabled) && Boolean(form.applyOnPublicSignup),
        trialDays: days,
        planId: form.planId || undefined,
      });
      toast.success('Free trial settings saved');
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to save free trial settings'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="py-8 text-sm text-[#667085]">Loading free trial settings...</p>;
  }

  return (
    <div className="rounded-xl border border-[#ECEFF3] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-8">
      <div className="max-w-xl space-y-5">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => update('enabled', e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-[#D0D5DD]"
            style={{ accentColor: ACCENT }}
          />
          <span>
            <span className="block text-sm font-semibold text-[#101828]">Enable free trials</span>
            <span className="mt-0.5 block text-[13px] text-[#667085]">
              Super Admin can grant trials to clients. Optionally apply the same default on public
              signup.
            </span>
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Trial plan</span>
          <select
            className={inputClass}
            value={form.planId}
            onChange={(e) => update('planId', e.target.value)}
            disabled={!form.enabled && !form.applyOnPublicSignup}
          >
            <option value="">Select a plan</option>
            {plans.map((plan) => {
              const id = plan.id || plan._id;
              return (
                <option key={id} value={id}>
                  {plan.name}
                  {plan.billing ? ` · ${plan.billing}` : ''}
                </option>
              );
            })}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
            Trial length (days)
          </span>
          <input
            type="number"
            min={1}
            max={3650}
            className={inputClass}
            value={form.trialDays}
            onChange={(e) => update('trialDays', e.target.value)}
          />
        </label>

        <label className={`flex items-start gap-3 ${form.enabled ? '' : 'opacity-50'}`}>
          <input
            type="checkbox"
            checked={form.applyOnPublicSignup}
            onChange={(e) => update('applyOnPublicSignup', e.target.checked)}
            disabled={!form.enabled}
            className="mt-1 h-4 w-4 rounded border-[#D0D5DD]"
            style={{ accentColor: ACCENT }}
          />
          <span>
            <span className="block text-sm font-semibold text-[#101828]">
              Apply on public signup
            </span>
            <span className="mt-0.5 block text-[13px] text-[#667085]">
              Verified admin signup can start this trial without Razorpay checkout.
            </span>
          </span>
        </label>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: ACCENT }}
        >
          {saving ? 'Saving...' : 'Save settings'}
        </button>
      </div>
    </div>
  );
}
