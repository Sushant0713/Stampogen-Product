const AppError = require('@utils/AppError');
const { HTTP_STATUS } = require('@constants');
const { ROLES } = require('@constants/roles');
const AffiliateEarningsRepository = require('@repositories/affiliateEarnings.repository');
const AffiliateSettingsService = require('@services/affiliateSettings.service');

function assertAffiliate(user) {
  const slug = user?.role?.slug || user?.role;
  if (slug !== ROLES.AFFILIATE) {
    throw new AppError('Affiliate access only', HTTP_STATUS.FORBIDDEN);
  }
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * Amount Stampogen gives the affiliate for one client payment.
 * Base = taxable revenue (list − discount), same as Super Admin client Revenue — never GST-inclusive payable.
 */
function taxableBaseForPayment(payment) {
  const list = Number(payment?.listAmount) || 0;
  const discount = Number(payment?.discountAmount) || 0;
  return Math.max(0, list - discount);
}

function earningForPayment(payment, commissionPercent) {
  const pct = Math.min(100, Math.max(0, Number(commissionPercent) || 20));
  const base = taxableBaseForPayment(payment);
  return roundMoney((base * pct) / 100);
}

/**
 * Payments oldest→newest for current cycle until earned sum covers currentTotal.
 */
function pickCurrentClients(payments, currentTotal, commissionPercent) {
  const target = roundMoney(currentTotal);
  if (target <= 0) return [];

  const picked = [];
  let running = 0;
  const chronological = [...payments].reverse();

  for (const payment of chronological) {
    const earned = earningForPayment(payment, commissionPercent);
    if (earned <= 0) continue;
    if (running >= target) break;

    const next = roundMoney(running + earned);
    if (next <= target + 0.01 || running === 0) {
      const listAmount = roundMoney(payment.listAmount);
      const discountAmount = roundMoney(payment.discountAmount);
      const taxableAmount = roundMoney(taxableBaseForPayment(payment));
      const payableAmount = roundMoney(payment.payableAmount);
      picked.push({
        id: String(payment._id),
        customerName: payment.customerName || '',
        customerEmail: payment.customerEmail || '',
        planName: payment.planName || '',
        /** What we credit the affiliate (settings % of taxable) */
        amount: earned,
        listAmount,
        discountAmount,
        taxableAmount,
        payableAmount,
        commissionPercent: Math.min(100, Math.max(0, Number(commissionPercent) || 20)),
        paidAt: payment.paidAt || payment.createdAt || null,
      });
      running = next;
    }
  }

  return picked;
}

class AffiliateEarningsService {
  async getSummary(user) {
    assertAffiliate(user);

    const discountCode = String(user.affiliateDiscountCode || '')
      .trim()
      .toUpperCase();
    const typeConfig = await AffiliateSettingsService.getTypeConfig(user.affiliateType);
    const minTarget = roundMoney(
      user.affiliateMinimumTargetValue != null
        ? user.affiliateMinimumTargetValue
        : typeConfig?.minimumTargetValue ?? 0
    );
    // Prefer per-affiliate override, else Affiliate Settings earning %
    const commissionPercent = Math.min(
      100,
      Math.max(
        0,
        Number(
          user.affiliateEarningPercent != null
            ? user.affiliateEarningPercent
            : typeConfig?.earningPercent ?? typeConfig?.defaultDiscountPercent ?? 20
        ) || 20
      )
    );

    const redeemStats = await AffiliateEarningsRepository.sumRedeems(user._id);
    const attributedPayments = discountCode
      ? await AffiliateEarningsRepository.listAttributedPayments({
          discountCode,
          limit: 200,
        })
      : [];

    // Lifetime earning = sum of (taxable × earning%) for every referred paid client
    const lifetimeEarned = roundMoney(
      attributedPayments.reduce(
        (sum, payment) => sum + earningForPayment(payment, commissionPercent),
        0
      )
    );

    const totalRedeemed = roundMoney(redeemStats.totalRedeemed);
    // Current = what we owe this cycle (lifetime earning − already redeemed)
    const current = Math.max(0, roundMoney(lifetimeEarned - totalRedeemed));
    const totalRevenue = roundMoney(totalRedeemed + current);
    const canRedeem = minTarget > 0 && current >= minTarget;

    const progressPercent =
      minTarget > 0 ? Math.min(100, Math.round((current / minTarget) * 1000) / 10) : 0;

    const currentClients = pickCurrentClients(
      attributedPayments,
      current,
      commissionPercent
    );

    return {
      discountCode,
      affiliateType: user.affiliateType || null,
      typeLabel: typeConfig?.label || user.affiliateType || null,
      minTarget,
      /** % from Affiliate Settings used to calculate what we pay the affiliate */
      commissionPercent,
      currentTotal: current,
      totalRevenue,
      totalRedeemed,
      canRedeem,
      progressPercent,
      overflowAmount: minTarget > 0 ? Math.max(0, roundMoney(current - minTarget)) : 0,
      paymentCountLifetime: attributedPayments.length,
      paymentCountCurrent: currentClients.length,
      redeemCount: redeemStats.redeemCount,
      lastRedeemedAt: redeemStats.lastRedeemedAt,
      remainingToRedeem: minTarget > 0 ? Math.max(0, roundMoney(minTarget - current)) : 0,
      currentClients,
    };
  }

  async redeem(user, { note = '' } = {}) {
    assertAffiliate(user);

    const summary = await this.getSummary(user);
    if (!summary.discountCode) {
      throw new AppError(
        'No affiliate discount code assigned yet. Contact Stampogen.',
        HTTP_STATUS.BAD_REQUEST
      );
    }
    if (summary.minTarget <= 0) {
      throw new AppError(
        'Minimum target is not configured for your affiliate type. Ask Super Admin to set it in Affiliate Settings.',
        HTTP_STATUS.BAD_REQUEST
      );
    }
    if (!summary.canRedeem) {
      throw new AppError(
        `You need at least ₹${summary.minTarget.toLocaleString('en-IN')} to redeem. Current: ₹${summary.currentTotal.toLocaleString('en-IN')}.`,
        HTTP_STATUS.BAD_REQUEST
      );
    }
    if (summary.currentTotal <= 0) {
      throw new AppError('Nothing available to redeem', HTTP_STATUS.BAD_REQUEST);
    }

    const redeem = await AffiliateEarningsRepository.createRedeem({
      affiliateUser: user._id,
      amount: summary.currentTotal,
      discountCode: summary.discountCode,
      attributedRevenueAtRedeem: summary.currentTotal,
      minTargetAtRedeem: summary.minTarget,
      note: String(note || '').trim().slice(0, 500),
      redeemedAt: new Date(),
    });

    const next = await this.getSummary(user);
    return {
      redeem: {
        id: String(redeem._id),
        amount: redeem.amount,
        redeemedAt: redeem.redeemedAt,
      },
      summary: next,
    };
  }

  async listRedeems(user) {
    assertAffiliate(user);
    const rows = await AffiliateEarningsRepository.listRedeems(user._id, { limit: 30 });
    return rows.map((row) => ({
      id: String(row._id),
      amount: Number(row.amount) || 0,
      discountCode: row.discountCode || '',
      redeemedAt: row.redeemedAt,
      note: row.note || '',
    }));
  }
}

module.exports = new AffiliateEarningsService();
