const AppError = require('@utils/AppError');
const { HTTP_STATUS } = require('@constants');
const { ROLES } = require('@constants/roles');
const AffiliateEarningsRepository = require('@repositories/affiliateEarnings.repository');
const AffiliateSettingsService = require('@services/affiliateSettings.service');
const UserRepository = require('@repositories/user.repository');
const {
  normalizeAffiliatePayout,
  payoutFromUser,
  formatPayoutForResponse,
} = require('@helpers/affiliatePayout.helper');

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

function mapRedeemRow(row) {
  const rawAffiliate = row.affiliateUser;
  const u =
    rawAffiliate && typeof rawAffiliate === 'object' && (rawAffiliate.email || rawAffiliate.firstName)
      ? rawAffiliate
      : null;
  const name = u
    ? [u.firstName, u.middleName, u.lastName].filter(Boolean).join(' ').trim()
    : '';
  return {
    id: String(row._id),
    amount: Number(row.amount) || 0,
    discountCode: row.discountCode || '',
    redeemedAt: row.redeemedAt,
    note: row.note || '',
    status: row.status || 'pending',
    decisionNote: row.decisionNote || '',
    decidedAt: row.decidedAt || null,
    payoutMethod: row.payoutMethod || '',
    payout: formatPayoutForResponse(row),
    affiliate: u
      ? {
          id: String(u._id || ''),
          name: name || '—',
          email: u.email || '',
          phone: u.phone || '',
          affiliateType: u.affiliateType || null,
          discountCode: u.affiliateDiscountCode || row.discountCode || '',
        }
      : null,
  };
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

    const lifetimeEarned = roundMoney(
      attributedPayments.reduce(
        (sum, payment) => sum + earningForPayment(payment, commissionPercent),
        0
      )
    );

    const totalRedeemed = roundMoney(redeemStats.totalRedeemed);
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
      savedPayout: payoutFromUser(user),
    };
  }

  async redeem(user, body = {}) {
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

    const payout = normalizeAffiliatePayout(body);
    const saveForLater = Boolean(body.saveForLater);
    const note = String(body.note || '').trim().slice(0, 500);

    const redeem = await AffiliateEarningsRepository.createRedeem({
      affiliateUser: user._id,
      amount: summary.currentTotal,
      discountCode: summary.discountCode,
      attributedRevenueAtRedeem: summary.currentTotal,
      minTargetAtRedeem: summary.minTarget,
      note,
      accountHolderName: payout.accountHolderName,
      accountNumber: payout.accountNumber,
      ifsc: payout.ifsc,
      bankName: payout.bankName,
      upiId: payout.upiId,
      payoutMethod: payout.payoutMethod,
      status: 'pending',
      redeemedAt: new Date(),
    });

    if (saveForLater) {
      await UserRepository.updateById(user._id, {
        affiliatePayoutAccountHolderName: payout.accountHolderName,
        affiliatePayoutAccountNumber: payout.accountNumber,
        affiliatePayoutIfsc: payout.ifsc,
        affiliatePayoutBankName: payout.bankName,
        affiliatePayoutUpiId: payout.upiId,
      });
    }

    const next = await this.getSummary(await UserRepository.findById(user._id));
    return {
      redeem: mapRedeemRow(redeem.toObject ? redeem.toObject() : redeem),
      summary: next,
    };
  }

  async listRedeems(user) {
    assertAffiliate(user);
    const rows = await AffiliateEarningsRepository.listRedeems(user._id, { limit: 30 });
    return rows.map((row) => mapRedeemRow(row));
  }

  async listAllRedeemsForAdmin(query = {}) {
    const { page = 1, limit = 20, status = '', search = '' } = query;
    const q = String(search || '')
      .trim()
      .toLowerCase();
    const pageNum = Math.max(1, Number(page) || 1);
    const lim = Math.min(100, Math.max(1, Number(limit) || 20));

    // When searching, load a wider window then filter (affiliate volume is typically modest).
    const fetchLimit = q ? 500 : lim;
    const fetchPage = q ? 1 : pageNum;

    const { rows, total: dbTotal } = await AffiliateEarningsRepository.listAllRedeems({
      page: fetchPage,
      limit: fetchLimit,
      status,
    });

    let mapped = rows.map((row) => mapRedeemRow(row));
    if (q) {
      mapped = mapped.filter((row) => {
        const hay = [
          row.affiliate?.name,
          row.affiliate?.email,
          row.affiliate?.phone,
          row.discountCode,
          row.payout?.accountHolderName,
          row.payout?.accountNumber,
          row.payout?.ifsc,
          row.payout?.bankName,
          row.payout?.upiId,
        ]
          .map((v) => String(v || '').toLowerCase())
          .join(' ');
        return hay.includes(q);
      });
      const total = mapped.length;
      const start = (pageNum - 1) * lim;
      mapped = mapped.slice(start, start + lim);
      return {
        redeems: mapped,
        pagination: {
          page: pageNum,
          limit: lim,
          total,
          totalPages: Math.max(1, Math.ceil(total / lim)),
        },
      };
    }

    return {
      redeems: mapped,
      pagination: {
        page: pageNum,
        limit: lim,
        total: dbTotal,
        totalPages: Math.max(1, Math.ceil(dbTotal / lim)),
      },
    };
  }

  async markRedeemPaid(redeemId, { note = '' } = {}) {
    const existing = await AffiliateEarningsRepository.findRedeemById(redeemId);
    if (!existing) {
      throw new AppError('Redeem request not found', HTTP_STATUS.NOT_FOUND);
    }
    if (existing.status === 'paid') {
      throw new AppError('This redeem is already marked as paid', HTTP_STATUS.BAD_REQUEST);
    }
    if (existing.status === 'rejected') {
      throw new AppError('Cannot mark a rejected redeem as paid', HTTP_STATUS.BAD_REQUEST);
    }

    const decisionNote = String(note || '').trim().slice(0, 1000);
    const updated = await AffiliateEarningsRepository.updateRedeemById(redeemId, {
      status: 'paid',
      decisionNote,
      decidedAt: new Date(),
    });

    const affiliate = updated?.affiliateUser || existing.affiliateUser || {};
    const email = affiliate.email;
    const name = [affiliate.firstName, affiliate.middleName, affiliate.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    if (email) {
      try {
        const { sendAffiliateRedeemPaidEmail } = require('@services/email.service');
        await sendAffiliateRedeemPaidEmail({
          to: email,
          name,
          amount: updated.amount ?? existing.amount,
          payoutMethod: updated.payoutMethod || existing.payoutMethod,
        });
      } catch (error) {
        console.warn('[affiliate-redeem] Paid email failed:', error.message);
      }
    }

    return mapRedeemRow(updated);
  }

  async rejectRedeem(redeemId, { note = '' } = {}) {
    const existing = await AffiliateEarningsRepository.findRedeemById(redeemId);
    if (!existing) {
      throw new AppError('Redeem request not found', HTTP_STATUS.NOT_FOUND);
    }
    if (existing.status === 'rejected') {
      throw new AppError('This redeem is already rejected', HTTP_STATUS.BAD_REQUEST);
    }
    if (existing.status === 'paid') {
      throw new AppError('Cannot reject a paid redeem', HTTP_STATUS.BAD_REQUEST);
    }

    const decisionNote = String(note || '').trim().slice(0, 1000);
    if (!decisionNote) {
      throw new AppError('Please provide a rejection reason', HTTP_STATUS.BAD_REQUEST);
    }

    const updated = await AffiliateEarningsRepository.updateRedeemById(redeemId, {
      status: 'rejected',
      decisionNote,
      decidedAt: new Date(),
    });

    const affiliate = updated?.affiliateUser || existing.affiliateUser || {};
    const email = affiliate.email;
    const name = [affiliate.firstName, affiliate.middleName, affiliate.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    if (email) {
      try {
        const { sendAffiliateRedeemRejectedEmail } = require('@services/email.service');
        await sendAffiliateRedeemRejectedEmail({
          to: email,
          name,
          amount: updated.amount ?? existing.amount,
          note: decisionNote,
        });
      } catch (error) {
        console.warn('[affiliate-redeem] Reject email failed:', error.message);
      }
    }

    return mapRedeemRow(updated);
  }
}

module.exports = new AffiliateEarningsService();
