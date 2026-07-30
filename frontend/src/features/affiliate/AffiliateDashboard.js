'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  CheckCircle2,
  Gift,
  Loader2,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { affiliateEarningsService } from '@/services/affiliateEarnings.service';
import { getErrorMessage } from '@/utils';

const ACCENT = '#021A54';

const emptyPayout = {
  accountHolderName: '',
  accountNumber: '',
  ifsc: '',
  bankName: '',
  upiId: '',
};

const inputClass =
  'h-10 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] outline-none focus:border-[#021A54] focus:ring-1 focus:ring-[#021A54]';

function formatMoney(value) {
  const n = Number(value) || 0;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function StatCard({ icon: Icon, label, value, hint, tone = 'default' }) {
  const tones = {
    default: {
      wrap: 'border-[#E5E7EB] bg-white',
      icon: 'bg-[#EEF2FF] text-[#021A54]',
      value: 'text-[#101828]',
    },
    accent: {
      wrap: 'border-[#C7D2FE] bg-[#F8FAFF]',
      icon: 'bg-[#021A54] text-white',
      value: 'text-[#021A54]',
    },
    success: {
      wrap: 'border-[#A7F3D0] bg-[#ECFDF5]',
      icon: 'bg-[#065F46] text-white',
      value: 'text-[#065F46]',
    },
    target: {
      wrap: 'border-[#FDE68A] bg-[#FFFBEB]',
      icon: 'bg-[#B45309] text-white',
      value: 'text-[#92400E]',
    },
  };
  const t = tones[tone] || tones.default;

  return (
    <div className={`rounded-2xl border px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${t.wrap}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#667085]">
            {label}
          </p>
          <p className={`mt-2 text-[26px] font-semibold tracking-tight ${t.value}`}>{value}</p>
          {hint ? <p className="mt-1 text-[13px] text-[#667085]">{hint}</p> : null}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.icon}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function validatePayoutClient(payout) {
  const accountHolderName = String(payout.accountHolderName || '').trim();
  const accountNumber = String(payout.accountNumber || '').replace(/\s+/g, '').trim();
  const ifsc = String(payout.ifsc || '').trim().toUpperCase();
  const bankName = String(payout.bankName || '').trim();
  const upiId = String(payout.upiId || '').trim();

  const bankFields = [accountHolderName, accountNumber, ifsc, bankName];
  const filled = bankFields.filter(Boolean).length;
  const hasBank = filled === 4;
  const hasPartial = filled > 0 && filled < 4;
  const hasUpi = Boolean(upiId);

  if (hasPartial) {
    return 'Complete all bank fields or clear them and use UPI only.';
  }
  if (!hasBank && !hasUpi) {
    return 'Provide bank details or a UPI ID (at least one required).';
  }
  if (hasBank && !/^\d{9,18}$/.test(accountNumber)) {
    return 'Account number must be 9–18 digits.';
  }
  if (hasBank && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
    return 'Enter a valid IFSC (e.g. HDFC0001234).';
  }
  if (hasUpi && !/^[\w.-]{2,256}@[\w.-]{2,64}$/i.test(upiId)) {
    return 'Enter a valid UPI ID (e.g. name@upi).';
  }
  return '';
}

export function AffiliateDashboard() {
  const { fullName, user } = useUser();
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [summary, setSummary] = useState(null);
  const [redeems, setRedeems] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [payout, setPayout] = useState(emptyPayout);
  const [saveForLater, setSaveForLater] = useState(true);
  const [payoutError, setPayoutError] = useState('');

  const load = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const [summaryRes, redeemsRes] = await Promise.all([
        affiliateEarningsService.getSummary(),
        affiliateEarningsService.listRedeems(),
      ]);
      const nextSummary = summaryRes.data?.data?.summary || null;
      setSummary(nextSummary);
      setRedeems(redeemsRes.data?.data?.redeems || []);
      if (nextSummary?.savedPayout) {
        setPayout({
          accountHolderName: nextSummary.savedPayout.accountHolderName || '',
          accountNumber: nextSummary.savedPayout.accountNumber || '',
          ifsc: nextSummary.savedPayout.ifsc || '',
          bankName: nextSummary.savedPayout.bankName || '',
          upiId: nextSummary.savedPayout.upiId || '',
        });
      }
    } catch (error) {
      if (!silent) {
        toast.error(getErrorMessage(error, 'Unable to load earnings'));
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openRedeem = () => {
    const saved = summary?.savedPayout || emptyPayout;
    setPayout({
      accountHolderName: saved.accountHolderName || '',
      accountNumber: saved.accountNumber || '',
      ifsc: saved.ifsc || '',
      bankName: saved.bankName || '',
      upiId: saved.upiId || '',
    });
    setSaveForLater(true);
    setPayoutError('');
    setConfirmOpen(true);
  };

  const updatePayout = (key, value) => {
    setPayout((prev) => ({ ...prev, [key]: value }));
    setPayoutError('');
  };

  const handleRedeem = async () => {
    const err = validatePayoutClient(payout);
    if (err) {
      setPayoutError(err);
      return;
    }
    try {
      setRedeeming(true);
      const { data } = await affiliateEarningsService.redeem({
        ...payout,
        ifsc: String(payout.ifsc || '').trim().toUpperCase(),
        accountNumber: String(payout.accountNumber || '').replace(/\s+/g, ''),
        saveForLater,
      });
      const next = data?.data?.summary;
      const amount = data?.data?.redeem?.amount;
      if (next) setSummary(next);
      toast.success(
        amount != null
          ? `Redeem request for ${formatMoney(amount)} submitted.`
          : 'Redeem request submitted'
      );
      setConfirmOpen(false);
      await load({ silent: true });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to redeem'));
    } finally {
      setRedeeming(false);
    }
  };

  const progressWidth = useMemo(() => {
    if (!summary?.minTarget) return 0;
    return Math.min(100, Number(summary.progressPercent) || 0);
  }, [summary]);

  const discountCode =
    summary?.discountCode ||
    String(user?.affiliateDiscountCode || '')
      .trim()
      .toUpperCase();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[#667085]">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading your earnings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[24px] border border-[#D6DEEE] bg-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 12% 20%, #021A54 0, transparent 42%), radial-gradient(circle at 88% 0%, #2E90FA 0, transparent 36%)',
          }}
        />
        <div className="relative px-6 py-7 sm:px-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#667085]">
            Affiliate dashboard
          </p>
          <h1 className="mt-2 font-display text-[30px] font-semibold tracking-tight text-[#021A54]">
            Welcome back{fullName ? `, ${fullName.split(' ')[0]}` : ''}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#475467]">
            For each client who uses your coupon, you earn your affiliate percentage of their
            taxable revenue (plan price after discount, same as Super Admin client Revenue — GST
            not included). Current total is the sum of those earnings toward your redeem target.
          </p>
          {discountCode ? (
            <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[#D0D5DD] bg-[#F8FAFC] px-3 py-2">
              <Sparkles size={15} className="text-[#021A54]" />
              <span className="text-[12px] font-medium text-[#667085]">Your code</span>
              <code className="font-mono text-sm font-bold text-[#021A54]">{discountCode}</code>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Wallet}
          label="Current total"
          value={formatMoney(summary?.currentTotal)}
          hint={
            summary?.paymentCountCurrent
              ? `${summary.paymentCountCurrent} client(s) · ${summary?.commissionPercent ?? 20}% of taxable`
              : `No referred sales yet · earning ${summary?.commissionPercent ?? 20}% of taxable`
          }
          tone="accent"
        />
        <StatCard
          icon={Target}
          label="Target"
          value={formatMoney(summary?.minTarget)}
          hint={
            summary?.minTarget > 0
              ? `Affiliate Settings · earn ${summary?.commissionPercent ?? 20}% per sale${
                  summary.typeLabel ? ` · ${summary.typeLabel}` : ''
                }`
              : 'Ask Super Admin to set minimum target'
          }
          tone="target"
        />
        <StatCard
          icon={TrendingUp}
          label="Total revenue"
          value={formatMoney(summary?.totalRevenue)}
          hint={`${formatMoney(summary?.totalRedeemed)} redeemed + ${formatMoney(summary?.currentTotal)} current`}
        />
        <StatCard
          icon={Gift}
          label="Revenue redeemed"
          value={formatMoney(summary?.totalRedeemed)}
          hint={
            summary?.redeemCount
              ? `${summary.redeemCount} redeem${summary.redeemCount === 1 ? '' : 's'} so far`
              : 'No redeems yet'
          }
          tone="success"
        />
      </div>

      <div className="rounded-[24px] border border-[#E5E7EB] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-[#021A54]">
              <Target size={18} />
              <p className="text-[13px] font-semibold uppercase tracking-[0.06em]">
                Progress to target
              </p>
            </div>
            <p className="mt-2 text-[15px] text-[#344054]">
              <span className="font-semibold text-[#021A54]">
                {formatMoney(summary?.currentTotal)}
              </span>
              <span className="text-[#98A2B3]"> achieved of </span>
              <span className="font-semibold text-[#92400E]">
                {formatMoney(summary?.minTarget || 0)}
              </span>
              <span className="text-[#98A2B3]"> target</span>
              {summary?.overflowAmount > 0 ? (
                <span className="ml-2 text-[13px] font-medium text-emerald-700">
                  (+{formatMoney(summary.overflowAmount)} above)
                </span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            disabled={!summary?.canRedeem || redeeming}
            onClick={openRedeem}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-45"
            style={{ backgroundColor: ACCENT }}
          >
            {redeeming ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Redeem
          </button>
        </div>

        <div className="mt-5">
          <div className="relative h-4 overflow-hidden rounded-full bg-[#EEF2F6]">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${progressWidth}%`,
                background: summary?.canRedeem
                  ? 'linear-gradient(90deg, #021A54 0%, #0B3B8C 55%, #12B76A 100%)'
                  : 'linear-gradient(90deg, #021A54 0%, #2E90FA 100%)',
              }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[12px] text-[#667085]">
            <span>{progressWidth}% achieved</span>
            <span>Target {formatMoney(summary?.minTarget || 0)}</span>
          </div>
        </div>

        {!summary?.minTarget ? (
          <p className="mt-4 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-[13px] text-[#92400E]">
            No target is set for your type yet. Super Admin must set{' '}
            <strong>Minimum target value</strong> in Affiliate Settings.
          </p>
        ) : !summary?.canRedeem ? (
          <p className="mt-4 rounded-xl border border-[#FEE4E2] bg-[#FEF3F2] px-4 py-3 text-[13px] text-[#B42318]">
            Need {formatMoney(summary.remainingToRedeem)} more to unlock Redeem (target{' '}
            {formatMoney(summary.minTarget)}).
          </p>
        ) : (
          <p className="mt-4 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-3 text-[13px] text-[#065F46]">
            Target reached. Redeem {formatMoney(summary.currentTotal)} now — share bank or UPI
            details so Stampogen can pay you.
          </p>
        )}
      </div>

      <div className="rounded-[24px] border border-[#E5E7EB] bg-white p-6 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[#101828]">Redeem history</h2>
          {summary?.lastRedeemedAt ? (
            <p className="text-[12px] text-[#667085]">
              Last {formatDateTime(summary.lastRedeemedAt)}
            </p>
          ) : null}
        </div>

        {redeems.length === 0 ? (
          <p className="mt-4 text-sm text-[#667085]">
            No redeems yet. Once you hit the target, history appears here.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[#F2F4F7]">
            {redeems.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-semibold text-[#101828]">
                    {formatMoney(row.amount)}
                  </p>
                  <p className="text-[12px] text-[#667085]">{formatDateTime(row.redeemedAt)}</p>
                  {row.payoutMethod ? (
                    <p className="mt-0.5 text-[11px] font-medium text-[#667085]">
                      Via {row.payoutMethod === 'both' ? 'bank + UPI' : row.payoutMethod}
                      {row.status === 'pending' ? ' · awaiting payout' : ''}
                    </p>
                  ) : null}
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    row.status === 'paid'
                      ? 'bg-[#ECFDF5] text-[#065F46]'
                      : row.status === 'rejected'
                        ? 'bg-[#FEF3F2] text-[#B42318]'
                        : 'bg-[#FFFBEB] text-[#92400E]'
                  }`}
                >
                  {row.status === 'paid'
                    ? 'Paid'
                    : row.status === 'rejected'
                      ? 'Rejected'
                      : 'Pending'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[#101828]">Redeem & payout details</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#475467]">
              Redeem{' '}
              <span className="font-semibold text-[#021A54]">
                {formatMoney(summary?.currentTotal)}
              </span>
              . Provide <strong>bank details or UPI</strong> (at least one). Super Admin will use
              these to transfer money.
            </p>

            <div className="mt-5 space-y-3">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#667085]">
                Bank transfer
              </p>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-[#344054]">
                  Account holder name
                </label>
                <input
                  className={inputClass}
                  value={payout.accountHolderName}
                  onChange={(e) => updatePayout('accountHolderName', e.target.value)}
                  placeholder="Name as on bank account"
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-[#344054]">
                  Account number
                </label>
                <input
                  className={inputClass}
                  value={payout.accountNumber}
                  onChange={(e) => updatePayout('accountNumber', e.target.value)}
                  placeholder="9–18 digit account number"
                  inputMode="numeric"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-[#344054]">IFSC</label>
                  <input
                    className={inputClass}
                    value={payout.ifsc}
                    onChange={(e) => updatePayout('ifsc', e.target.value.toUpperCase())}
                    placeholder="HDFC0001234"
                    autoCapitalize="characters"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium text-[#344054]">
                    Bank name
                  </label>
                  <input
                    className={inputClass}
                    value={payout.bankName}
                    onChange={(e) => updatePayout('bankName', e.target.value)}
                    placeholder="Bank name"
                  />
                </div>
              </div>

              <p className="pt-2 text-[12px] font-semibold uppercase tracking-wide text-[#667085]">
                Or UPI
              </p>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-[#344054]">
                  UPI ID <span className="font-normal text-[#98A2B3]">(optional if bank filled)</span>
                </label>
                <input
                  className={inputClass}
                  value={payout.upiId}
                  onChange={(e) => updatePayout('upiId', e.target.value)}
                  placeholder="name@upi"
                />
              </div>

              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] px-3 py-3">
                <input
                  type="checkbox"
                  checked={saveForLater}
                  onChange={(e) => setSaveForLater(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-[#D0D5DD] text-[#021A54] focus:ring-[#021A54]"
                />
                <span className="text-[13px] leading-snug text-[#344054]">
                  <span className="font-semibold text-[#101828]">Save these details</span> for next
                  redeem. Uncheck to use them only for this request.
                </span>
              </label>

              {payoutError ? (
                <p className="rounded-lg border border-[#FECDCA] bg-[#FEF3F2] px-3 py-2 text-[13px] text-[#B42318]">
                  {payoutError}
                </p>
              ) : null}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={redeeming}
                onClick={() => setConfirmOpen(false)}
                className="h-10 rounded-lg border border-[#D0D5DD] px-4 text-sm font-semibold text-[#344054]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={redeeming}
                onClick={handleRedeem}
                className="inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: ACCENT }}
              >
                {redeeming ? <Loader2 size={15} className="animate-spin" /> : null}
                Submit redeem
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
