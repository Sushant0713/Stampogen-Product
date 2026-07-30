const AppError = require('@utils/AppError');
const { HTTP_STATUS } = require('@constants');

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_RE = /^\d{9,18}$/;
const UPI_RE = /^[\w.-]{2,256}@[\w.-]{2,64}$/i;

function trimStr(value, max = 120) {
  return String(value || '')
    .trim()
    .slice(0, max);
}

/**
 * Normalize + validate payout input.
 * At least one of: complete bank details OR UPI ID.
 */
function normalizeAffiliatePayout(input = {}) {
  const accountHolderName = trimStr(input.accountHolderName, 120);
  const accountNumber = String(input.accountNumber || '')
    .replace(/\s+/g, '')
    .trim();
  const ifsc = String(input.ifsc || '')
    .trim()
    .toUpperCase();
  const bankName = trimStr(input.bankName, 120);
  const upiId = trimStr(input.upiId, 120).toLowerCase();

  const bankFields = [accountHolderName, accountNumber, ifsc, bankName];
  const bankFilledCount = bankFields.filter(Boolean).length;
  const hasCompleteBank = bankFilledCount === 4;
  const hasPartialBank = bankFilledCount > 0 && bankFilledCount < 4;
  const hasUpi = Boolean(upiId);

  if (hasPartialBank) {
    throw new AppError(
      'Complete all bank fields (holder name, account number, IFSC, bank name) or leave them empty and use UPI.',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  if (!hasCompleteBank && !hasUpi) {
    throw new AppError(
      'Provide bank transfer details or a UPI ID (at least one is required).',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  if (hasCompleteBank) {
    if (!ACCOUNT_RE.test(accountNumber)) {
      throw new AppError('Account number must be 9–18 digits', HTTP_STATUS.BAD_REQUEST);
    }
    if (!IFSC_RE.test(ifsc)) {
      throw new AppError('Enter a valid IFSC code (e.g. HDFC0001234)', HTTP_STATUS.BAD_REQUEST);
    }
  }

  if (hasUpi && !UPI_RE.test(upiId)) {
    throw new AppError('Enter a valid UPI ID (e.g. name@upi)', HTTP_STATUS.BAD_REQUEST);
  }

  let payoutMethod = 'bank';
  if (hasCompleteBank && hasUpi) payoutMethod = 'both';
  else if (hasUpi) payoutMethod = 'upi';

  return {
    accountHolderName: hasCompleteBank ? accountHolderName : '',
    accountNumber: hasCompleteBank ? accountNumber : '',
    ifsc: hasCompleteBank ? ifsc : '',
    bankName: hasCompleteBank ? bankName : '',
    upiId: hasUpi ? upiId : '',
    payoutMethod,
  };
}

function payoutFromUser(user) {
  return {
    accountHolderName: user?.affiliatePayoutAccountHolderName || '',
    accountNumber: user?.affiliatePayoutAccountNumber || '',
    ifsc: user?.affiliatePayoutIfsc || '',
    bankName: user?.affiliatePayoutBankName || '',
    upiId: user?.affiliatePayoutUpiId || '',
  };
}

function formatPayoutForResponse(payout = {}) {
  return {
    accountHolderName: payout.accountHolderName || '',
    accountNumber: payout.accountNumber || '',
    ifsc: payout.ifsc || '',
    bankName: payout.bankName || '',
    upiId: payout.upiId || '',
    payoutMethod: payout.payoutMethod || '',
  };
}

module.exports = {
  normalizeAffiliatePayout,
  payoutFromUser,
  formatPayoutForResponse,
};
