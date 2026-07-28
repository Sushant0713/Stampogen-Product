'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { agreementSettingsService } from '@/services/agreementSettings.service';
import { getErrorMessage } from '@/utils';

const ACCENT = '#021A54';

const AUDIENCE = {
  AFFILIATE: 'affiliate',
  CLIENT: 'client',
};

const inputClass =
  'h-10 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none focus:border-[#021A54] focus:ring-1 focus:ring-[#021A54]';

const textareaClass =
  'min-h-[280px] w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm leading-relaxed text-[#101828] outline-none focus:border-[#021A54] focus:ring-1 focus:ring-[#021A54]';

function Toggle({ checked, onChange, label, hint }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-[#ECEFF3] bg-[#F9FAFB] px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-[#101828]">{label}</p>
        {hint ? <p className="mt-0.5 text-[12px] text-[#667085]">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? 'bg-[#021A54]' : 'bg-[#D0D5DD]'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}

export function AgreementSettings() {
  const [audience, setAudience] = useState(AUDIENCE.AFFILIATE);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (nextAudience = audience) => {
    try {
      setLoading(true);
      const { data } = await agreementSettingsService.get(nextAudience);
      setSettings(data.data.settings);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to load terms and conditions'));
    } finally {
      setLoading(false);
    }
  }, [audience]);

  useEffect(() => {
    load(audience);
  }, [audience, load]);

  const handleAudienceChange = (nextAudience) => {
    if (nextAudience === audience) return;
    setAudience(nextAudience);
    setSettings(null);
  };

  const updateField = (key, value) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async () => {
    if (!settings) return;
    if (!String(settings.title || '').trim()) {
      toast.error('Title is required');
      return;
    }
    if (!String(settings.content || '').trim()) {
      toast.error('Terms and conditions content is required');
      return;
    }
    try {
      setSaving(true);
      const { data } = await agreementSettingsService.save({
        audience,
        title: settings.title.trim(),
        content: settings.content.trim(),
        version: settings.version.trim() || '1.0',
        effectiveDate: settings.effectiveDate || '',
        requireAcceptance: settings.requireAcceptance !== false,
        isActive: settings.isActive !== false,
      });
      setSettings(data.data.settings);
      toast.success('Terms and conditions saved');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to save terms and conditions'));
    } finally {
      setSaving(false);
    }
  };

  const audienceLabel =
    audience === AUDIENCE.CLIENT ? 'Client' : 'Affiliate Partner';

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[#ECEFF3] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <p className="mb-2 text-[13px] font-semibold text-[#101828]">Audience</p>
        <div className="inline-flex rounded-lg border border-[#D0D5DD] bg-[#F9FAFB] p-1">
          <button
            type="button"
            onClick={() => handleAudienceChange(AUDIENCE.AFFILIATE)}
            className={`h-9 rounded-md px-4 text-sm font-semibold transition ${
              audience === AUDIENCE.AFFILIATE
                ? 'bg-[#021A54] text-white'
                : 'text-[#344054] hover:bg-white'
            }`}
          >
            Affiliate Partner
          </button>
          <button
            type="button"
            onClick={() => handleAudienceChange(AUDIENCE.CLIENT)}
            className={`h-9 rounded-md px-4 text-sm font-semibold transition ${
              audience === AUDIENCE.CLIENT
                ? 'bg-[#021A54] text-white'
                : 'text-[#344054] hover:bg-white'
            }`}
          >
            Client
          </button>
        </div>
        <p className="mt-2 text-[12px] text-[#667085]">
          Switch between Affiliate Partner and Client terms and conditions.
        </p>
      </div>

      {loading || !settings ? (
        <div className="rounded-xl border border-[#ECEFF3] bg-white px-5 py-12 text-center text-sm text-[#667085]">
          Loading terms and conditions...
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-4 rounded-xl border border-[#ECEFF3] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div>
              <h2 className="text-base font-semibold text-[#101828]">
                {audienceLabel} terms details
              </h2>
              <p className="mt-1 text-sm text-[#667085]">
                {audience === AUDIENCE.AFFILIATE
                  ? 'Used at registration, and emailed as a PDF with a signed-agreement upload link when you Hold an affiliate (Pending Affiliates).'
                  : `Configure the terms and conditions shown to ${audienceLabel.toLowerCase()}s.`}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[13px] font-semibold text-[#101828]">
                  Title *
                </label>
                <input
                  className={inputClass}
                  value={settings.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder="Terms and Conditions"
                />
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-semibold text-[#101828]">
                  Version
                </label>
                <input
                  className={inputClass}
                  value={settings.version}
                  onChange={(e) => updateField('version', e.target.value)}
                  placeholder="1.0"
                />
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-semibold text-[#101828]">
                  Effective date
                </label>
                <input
                  type="date"
                  className={inputClass}
                  value={settings.effectiveDate || ''}
                  onChange={(e) => updateField('effectiveDate', e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[13px] font-semibold text-[#101828]">
                  Terms and conditions content *
                </label>
                <textarea
                  className={textareaClass}
                  value={settings.content}
                  onChange={(e) => updateField('content', e.target.value)}
                  placeholder="Paste or write the full terms and conditions…"
                />
              </div>
            </div>

            <Toggle
              checked={settings.requireAcceptance !== false}
              onChange={(value) => updateField('requireAcceptance', value)}
              label="Require acceptance"
              hint={`${audienceLabel}s must accept these terms before continuing.`}
            />
            <Toggle
              checked={settings.isActive !== false}
              onChange={(value) => updateField('isActive', value)}
              label="Active"
              hint={`Inactive terms are hidden from the ${audienceLabel.toLowerCase()} flow.`}
            />

            <div className="flex justify-end pt-1">
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="h-10 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: ACCENT }}
              >
                {saving ? 'Saving…' : 'Save terms and conditions'}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-[#ECEFF3] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[#101828]">Preview</h2>
                <p className="mt-1 text-sm text-[#667085]">
                  {audienceLabel} terms preview.
                </p>
              </div>
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-medium ${
                  settings.isActive !== false
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-[#F2F4F7] text-[#667085]'
                }`}
              >
                {settings.isActive !== false ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] p-5">
              <h3 className="text-lg font-semibold text-[#101828]">
                {settings.title || '—'}
              </h3>
              <p className="mt-1 text-[12px] text-[#667085]">
                Version {settings.version || '1.0'}
                {settings.effectiveDate ? ` · Effective ${settings.effectiveDate}` : ''}
              </p>
              <div className="mt-4 max-h-[520px] overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed text-[#344054]">
                {settings.content || 'No terms and conditions content yet.'}
              </div>
              {settings.requireAcceptance !== false ? (
                <label className="mt-5 flex items-start gap-2 text-[13px] text-[#344054]">
                  <input type="checkbox" className="mt-0.5" disabled readOnly />
                  <span>
                    I have read and agree to these Terms and Conditions.
                  </span>
                </label>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
