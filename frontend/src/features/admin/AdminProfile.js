'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { getErrorMessage, getLoginPath } from '@/utils';
import { ROLES } from '@/constants';
import { AdminPageHeader } from '@/features/admin/AdminPageShell';
import { adminCardClass } from '@/features/admin/adminTheme';
import {
  LoyaltyStampModeSelector,
  loyaltyStampModeLabel,
} from '@/features/admin/LoyaltyStampModeSelector';
import {
  SOCIAL_LINK_FIELDS,
  SocialPlatformIcon,
  emptySocialLinks,
} from '@/features/shared/ShopSocialLinks';
import {
  BillingAddressFields,
  composeBillingAddress,
} from '@/components/forms/BillingAddressFields';
import { loyaltyService } from '@/services/loyalty.service';
import {
  DEFAULT_STAMP_SOUND_VOLUME,
  getStampRequestSoundVolume,
  playStampRequestSound,
  setStampRequestSoundVolume,
  unlockStampRequestSound,
} from '@/utils/stampRequestSound';

function mapBillingProfile(bp = {}, phoneFallback = '') {
  const lines = String(bp.address || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let street = String(bp.street || '').trim();
  let city = String(bp.city || '').trim();
  let state = String(bp.state || '').trim();
  let pin = String(bp.pin || '').trim();

  if (!street && lines[0]) street = lines[0];
  if ((!city || !state) && lines[1]) {
    const parts = lines[1].split(',').map((p) => p.trim()).filter(Boolean);
    if (!city && parts[0]) city = parts[0];
    if (!state && parts[1]) state = parts[1];
  }
  if (!pin) {
    const pinLine = lines.find((l) => /\bPIN\s*\d{6}\b/i.test(l) || /^\d{6}$/.test(l));
    if (pinLine) {
      const m = pinLine.match(/(\d{6})/);
      if (m) pin = m[1];
    }
  }

  return {
    phone: String(bp.phone || phoneFallback || '').trim(),
    street,
    state,
    stateCode: String(bp.stateCode || '').trim(),
    city,
    pin,
    gstin: String(bp.gstin || '').trim(),
    pan: String(bp.pan || '').trim(),
  };
}

function initials(fullName) {
  const parts = String(fullName || 'A').trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

function ProfileRow({ emoji, label, detail, href }) {
  const inner = (
    <>
      <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[rgba(59,130,246,0.12)] text-[15px]">
        {emoji}
      </div>
      <span className="flex-1 text-[13px] font-semibold text-[#021A54]">{label}</span>
      {detail ? (
        <span className="max-w-[120px] truncate text-xs font-semibold text-[#94A3B8]">
          {detail}
        </span>
      ) : (
        <ChevronRight size={14} className="text-[#CBD5E1]" />
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="flex items-center gap-3 border-b border-[#F1F5F9] px-4 py-3.5 last:border-0 hover:bg-[#F8FAFC]"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 border-b border-[#F1F5F9] px-4 py-3.5 last:border-0">
      {inner}
    </div>
  );
}

export function AdminProfile() {
  const router = useRouter();
  const { logout } = useAuth();
  const { fullName, email, user } = useUser();
  const isOutlet = Boolean(user?.isOutlet || user?.tenant?.kind === 'outlet');
  const isHqAdmin = !isOutlet;
  const shopName = user?.tenant?.name || 'Your shop';
  const sub = user?.subscription || user?.tenant?.subscription || null;

  const [stampMode, setStampMode] = useState(user?.tenant?.loyaltyStampMode || 'bill');
  const [savingMode, setSavingMode] = useState(false);
  const [soundVolume, setSoundVolume] = useState(DEFAULT_STAMP_SOUND_VOLUME);
  const [socialLinks, setSocialLinks] = useState(() => emptySocialLinks());
  const [savingSocial, setSavingSocial] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);
  const [billing, setBilling] = useState(() =>
    mapBillingProfile(user?.tenant?.billingProfile, user?.phone)
  );
  const [billingOpen, setBillingOpen] = useState(true);
  const [savingBilling, setSavingBilling] = useState(false);
  const [billingErrors, setBillingErrors] = useState({});

  const billingSummary = [
    billing.street,
    billing.city,
    billing.state,
    billing.pin,
  ]
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .join(' · ');
  const hasBillingOnFile = Boolean(billingSummary || billing.gstin || billing.phone);

  useEffect(() => {
    setSoundVolume(getStampRequestSoundVolume());
  }, []);

  // Prefill from auth/me as soon as user is available (including phone when address is empty).
  useEffect(() => {
    if (!user) return;
    setBilling(mapBillingProfile(user?.tenant?.billingProfile, user?.phone));
  }, [user, user?.tenant?.billingProfile, user?.phone]);

  const loadSettings = useCallback(async () => {
    try {
      const { data } = await loyaltyService.adminGetSettings();
      const settings = data.data?.settings;
      if (settings?.loyaltyStampMode) {
        setStampMode(settings.loyaltyStampMode);
      }
      if (settings?.socialLinks) {
        setSocialLinks({ ...emptySocialLinks(), ...settings.socialLinks });
      }
      // Always apply — backend fills phone / HQ fallback for outlets.
      setBilling(mapBillingProfile(settings?.billingProfile || {}, user?.phone));
    } catch {
      // keep tenant value from user context
    }
  }, [user?.phone]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleBillingChange = useCallback((next) => {
    setBilling((prev) => ({ ...prev, ...next }));
    setBillingErrors({});
  }, []);

  const handleSaveBilling = async () => {
    const street = String(billing.street || '').trim();
    const city = String(billing.city || '').trim();
    const state = String(billing.state || '').trim();
    const pin = String(billing.pin || '').trim();
    const phone = String(billing.phone || '').trim();
    const nextErrors = {};
    if (street.length < 3) nextErrors.street = 'Street address is required';
    if (!state) nextErrors.state = 'State is required';
    if (!city) nextErrors.city = 'City is required';
    if (!/^\d{6}$/.test(pin)) nextErrors.pin = 'PIN must be 6 digits';
    if (phone && phone.replace(/\D/g, '').length < 8) nextErrors.phone = 'Enter a valid phone';
    if (Object.keys(nextErrors).length) {
      setBillingErrors(nextErrors);
      toast.error('Please complete the billing address');
      return;
    }

    setSavingBilling(true);
    try {
      const payload = {
        phone,
        street,
        city,
        state,
        pin,
        address: composeBillingAddress({ street, city, state, pin }),
        gstin: String(billing.gstin || '').trim().toUpperCase(),
        pan: String(billing.pan || '').trim().toUpperCase(),
      };
      const { data } = await loyaltyService.adminUpdateSettings({ billingProfile: payload });
      const saved = data?.data?.settings?.billingProfile || payload;
      setBilling(mapBillingProfile(saved, user?.phone));
      toast.success('Billing details updated');
      setBillingOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to update billing details'));
    } finally {
      setSavingBilling(false);
    }
  };

  const handleSoundVolumeChange = (next) => {
    const saved = setStampRequestSoundVolume(Number(next) / 100);
    setSoundVolume(saved);
  };

  const handlePreviewSound = () => {
    void unlockStampRequestSound().then(() => {
      playStampRequestSound();
    });
  };

  const handleModeChange = async (nextMode) => {
    if (!nextMode || nextMode === stampMode || savingMode) return;
    const previous = stampMode;
    setStampMode(nextMode);
    setSavingMode(true);
    try {
      const { data } = await loyaltyService.adminUpdateSettings({ loyaltyStampMode: nextMode });
      const saved = data?.data?.settings?.loyaltyStampMode || nextMode;
      setStampMode(saved);
      toast.success(
        saved === 'request'
          ? 'Stamp requests enabled — customers will ask you to approve stamps.'
          : 'Bill scanner enabled — customers will photograph bills.',
        { id: 'stamp-mode-updated' }
      );
    } catch (error) {
      setStampMode(previous);
      toast.error(getErrorMessage(error, 'Unable to update stamp mode'), {
        id: 'stamp-mode-updated',
      });
    } finally {
      setSavingMode(false);
    }
  };

  const handleSocialChange = (key, value) => {
    setSocialLinks((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveSocial = async () => {
    try {
      setSavingSocial(true);
      const { data } = await loyaltyService.adminUpdateSettings({ socialLinks });
      const saved = data?.data?.settings?.socialLinks;
      if (saved) setSocialLinks({ ...emptySocialLinks(), ...saved });
      toast.success('Social links saved — they appear on your customer loyalty cards');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to save social links'));
    } finally {
      setSavingSocial(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out');
      router.push(getLoginPath(ROLES.ADMIN));
    } catch (error) {
      toast.error(getErrorMessage(error, 'Logout failed'));
    }
  };

  const filledSocialCount = SOCIAL_LINK_FIELDS.filter((f) =>
    String(socialLinks[f.key] || '').trim()
  ).length;

  return (
    <div className="mx-auto w-full max-w-3xl lg:max-w-none">
      <AdminPageHeader title="Profile" />

      <div className="relative mb-5 overflow-hidden rounded-[20px] bg-gradient-to-br from-[#021A54] to-[#3B82F6] p-5 shadow-[0_16px_34px_rgba(2,26,84,0.24)]">
        <div className="pointer-events-none absolute -right-5 -top-8 h-[110px] w-[110px] rounded-full bg-white/10" />
        <div className="relative flex items-center gap-3.5">
          <div className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-full bg-white/20 text-xl font-extrabold text-white">
            {initials(fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-extrabold text-white">{shopName}</p>
            <p className="truncate text-[11.5px] font-medium text-white/75">{email}</p>
            {sub?.planName ? (
              <p className="mt-0.5 text-[11.5px] font-semibold text-[#FCD34D]">
                Plan: {sub.planName}
                {sub.daysRemaining != null ? ` · ${sub.daysRemaining}d left` : ''}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <p className="mb-2.5 pl-0.5 text-xs font-extrabold tracking-wide text-[#94A3B8]">
        LOYALTY
      </p>
      <div className={adminCardClass('mb-5 p-4')}>
        <p className="mb-1 text-sm font-bold text-[#021A54]">Stamp collection type</p>
        <p className="mb-3 text-xs text-[#64748B]">
          Current: {loyaltyStampModeLabel(stampMode)}. Changes apply immediately for new customer
          visits.
        </p>
        <LoyaltyStampModeSelector
          value={stampMode}
          onChange={handleModeChange}
          disabled={savingMode}
        />
      </div>

      <p className="mb-2.5 pl-0.5 text-xs font-extrabold tracking-wide text-[#94A3B8]">
        BILLING ADDRESS
      </p>
      <div className={adminCardClass('mb-5 overflow-hidden')}>
        <button
          type="button"
          onClick={() => setBillingOpen((v) => !v)}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-[#F8FAFC]"
          aria-expanded={billingOpen}
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#021A54]">
              {hasBillingOnFile ? 'Edit invoice & client details' : 'Invoice & client details'}
            </p>
            <p className="mt-0.5 text-xs text-[#64748B]">
              {hasBillingOnFile
                ? billingSummary ||
                  [billing.phone, billing.gstin].filter(Boolean).join(' · ') ||
                  'Details from registration — tap to edit'
                : 'No billing details on file yet — tap to add'}
            </p>
          </div>
          <span className="shrink-0 rounded-lg bg-[#EEF2FF] px-2.5 py-1 text-[11px] font-bold text-[#021A54]">
            {billingOpen ? 'Close' : 'Edit'}
          </span>
          <ChevronDown
            size={18}
            className={`shrink-0 text-[#94A3B8] transition ${billingOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {billingOpen ? (
          <div className="space-y-3 border-t border-[#F1F5F9] px-4 pb-4 pt-3">
            <p className="text-[12px] leading-relaxed text-[#667085]">
              {hasBillingOnFile
                ? 'Saved invoice details for your shop. Update only if something changed — Super Admin sees the latest values on your client record.'
                : 'Add your invoice address here. If you entered it at registration and it is missing, save it once and it will stay on your profile.'}
            </p>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-bold text-[#021A54]">Phone</span>
              <input
                type="tel"
                value={billing.phone}
                onChange={(e) => handleBillingChange({ phone: e.target.value })}
                placeholder="+91 98765 43210"
                className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 text-[13px] text-[#021A54] outline-none transition placeholder:text-[#94A3B8] focus:border-[#3B82F6] focus:bg-white focus:ring-2 focus:ring-[#3B82F6]/20"
              />
              {billingErrors.phone ? (
                <p className="mt-1 text-xs text-red-500">{billingErrors.phone}</p>
              ) : null}
            </label>

            <BillingAddressFields
              idPrefix="profile-"
              values={billing}
              errors={billingErrors}
              onChange={handleBillingChange}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-bold text-[#021A54]">
                  GSTIN <span className="font-normal text-[#94A3B8]">(optional)</span>
                </span>
                <input
                  value={billing.gstin}
                  onChange={(e) => handleBillingChange({ gstin: e.target.value.toUpperCase() })}
                  placeholder="22AAAAA0000A1Z5"
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 text-[13px] text-[#021A54] outline-none transition placeholder:text-[#94A3B8] focus:border-[#3B82F6] focus:bg-white focus:ring-2 focus:ring-[#3B82F6]/20"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-bold text-[#021A54]">
                  PAN <span className="font-normal text-[#94A3B8]">(optional)</span>
                </span>
                <input
                  value={billing.pan}
                  onChange={(e) => handleBillingChange({ pan: e.target.value.toUpperCase() })}
                  placeholder="ABCDE1234F"
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 text-[13px] text-[#021A54] outline-none transition placeholder:text-[#94A3B8] focus:border-[#3B82F6] focus:bg-white focus:ring-2 focus:ring-[#3B82F6]/20"
                />
              </label>
            </div>

            <button
              type="button"
              disabled={savingBilling}
              onClick={handleSaveBilling}
              className="mt-2 w-full rounded-2xl bg-[#021A54] py-3 text-sm font-bold text-white hover:bg-[#0B2C6E] disabled:opacity-60"
            >
              {savingBilling ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        ) : null}
      </div>

      <p className="mb-2.5 pl-0.5 text-xs font-extrabold tracking-wide text-[#94A3B8]">
        SOCIAL LINKS
      </p>
      <div className={adminCardClass('mb-5 overflow-hidden')}>
        <button
          type="button"
          onClick={() => setSocialOpen((v) => !v)}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-[#F8FAFC]"
          aria-expanded={socialOpen}
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#021A54]">Share your channels</p>
            <p className="mt-0.5 text-xs text-[#64748B]">
              {filledSocialCount > 0
                ? `${filledSocialCount} link${filledSocialCount === 1 ? '' : 's'} saved · tap to ${socialOpen ? 'close' : 'edit'}`
                : `Facebook, Instagram, X, YouTube, WhatsApp, Google Review · ${socialOpen ? 'close' : 'open'}`}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[#EFF6FF] px-2.5 py-1 text-[10px] font-bold text-[#1D4ED8]">
            {filledSocialCount}/{SOCIAL_LINK_FIELDS.length}
          </span>
          <ChevronDown
            size={18}
            className={`shrink-0 text-[#94A3B8] transition ${socialOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {socialOpen ? (
          <div className="border-t border-[#F1F5F9] px-4 pb-4 pt-3">
            <p className="mb-3 text-xs leading-relaxed text-[#64748B]">
              Paste your links below. Customers see them on your loyalty card page.
            </p>
            <div className="space-y-3">
              {SOCIAL_LINK_FIELDS.map((field) => (
                <label key={field.key} className="block">
                  <span className="mb-1.5 flex items-center gap-2 text-[12px] font-bold text-[#021A54]">
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-white"
                      style={{ backgroundColor: field.color }}
                    >
                      <SocialPlatformIcon platform={field.key} />
                    </span>
                    {field.label}
                  </span>
                  <input
                    type="url"
                    value={socialLinks[field.key] || ''}
                    onChange={(e) => handleSocialChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 text-[13px] text-[#021A54] outline-none transition placeholder:text-[#94A3B8] focus:border-[#3B82F6] focus:bg-white focus:ring-2 focus:ring-[#3B82F6]/20"
                  />
                </label>
              ))}
            </div>

            <button
              type="button"
              disabled={savingSocial}
              onClick={handleSaveSocial}
              className="mt-4 w-full rounded-2xl bg-[#021A54] py-3 text-sm font-bold text-white hover:bg-[#0B2C6E] disabled:opacity-60"
            >
              {savingSocial ? 'Saving…' : 'Save social links'}
            </button>
          </div>
        ) : null}
      </div>

      <p className="mb-2.5 pl-0.5 text-xs font-extrabold tracking-wide text-[#94A3B8]">
        NOTIFICATIONS
      </p>
      <div className={adminCardClass('mb-5 p-4')}>
        <p className="mb-1 text-sm font-bold text-[#021A54]">Stamp request sound</p>
        <p className="mb-3 text-xs text-[#64748B]">
          Plays when a customer sends a new stamp request. Default volume is high.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="stamp-sound-volume">
            Notification volume
          </label>
          <input
            id="stamp-sound-volume"
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(soundVolume * 100)}
            onChange={(e) => handleSoundVolumeChange(e.target.value)}
            className="h-2 w-full max-w-[220px] cursor-pointer accent-[#021A54]"
          />
          <span className="min-w-[3rem] text-sm font-bold text-[#021A54]">
            {Math.round(soundVolume * 100)}%
          </span>
          <button
            type="button"
            onClick={handlePreviewSound}
            className="rounded-xl border border-[#D0D5DD] bg-white px-3 py-2 text-xs font-bold text-[#021A54] hover:bg-[#F8FAFC]"
          >
            Preview
          </button>
        </div>
      </div>

      {isHqAdmin ? (
        <>
          <p className="mb-2.5 pl-0.5 text-xs font-extrabold tracking-wide text-[#94A3B8]">
            OUTLETS
          </p>
          <div className={adminCardClass('mb-5 overflow-hidden')}>
            <ProfileRow emoji="🏪" label="My outlets" href="/admin/outlets" />
            <ProfileRow
              emoji="🛒"
              label="Browse outlet plans"
              href="/admin/plans/outlet/browse"
            />
          </div>

          <p className="mb-2.5 pl-0.5 text-xs font-extrabold tracking-wide text-[#94A3B8]">
            SUBSCRIPTION
          </p>
          <div className={adminCardClass('mb-5 overflow-hidden')}>
            <ProfileRow emoji="📦" label="My plan" href="/admin/plans/my" />
            <ProfileRow emoji="✨" label="Browse plans" href="/admin/plans/browse" />
          </div>
        </>
      ) : null}

      <p className="mb-2.5 pl-0.5 text-xs font-extrabold tracking-wide text-[#94A3B8]">
        BUSINESS DETAILS
      </p>
      <div className={adminCardClass('mb-5 overflow-hidden')}>
        <ProfileRow emoji="✉️" label="Email address" detail={email || '—'} />
        <ProfileRow emoji="👤" label="Account name" detail={fullName || '—'} />
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 py-3.5 text-sm font-bold text-red-600 active:scale-[0.99]"
      >
        <LogOut size={18} />
        Log out
      </button>
    </div>
  );
}
