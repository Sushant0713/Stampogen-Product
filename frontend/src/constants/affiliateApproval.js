export const AFFILIATE_APPROVAL_STATUS = {
  PENDING_REVIEW: 'pending_review',
  ON_HOLD: 'on_hold',
  INTERVIEW_SCHEDULED: 'interview_scheduled',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export const AFFILIATE_APPROVAL_VALUES = Object.values(AFFILIATE_APPROVAL_STATUS);

export const AFFILIATE_PENDING_STATUSES = [
  AFFILIATE_APPROVAL_STATUS.PENDING_REVIEW,
  AFFILIATE_APPROVAL_STATUS.ON_HOLD,
  AFFILIATE_APPROVAL_STATUS.INTERVIEW_SCHEDULED,
];

export const AFFILIATE_APPROVAL_LABELS = {
  [AFFILIATE_APPROVAL_STATUS.PENDING_REVIEW]: 'Pending review',
  [AFFILIATE_APPROVAL_STATUS.ON_HOLD]: 'On hold',
  [AFFILIATE_APPROVAL_STATUS.INTERVIEW_SCHEDULED]: 'Interview scheduled',
  [AFFILIATE_APPROVAL_STATUS.APPROVED]: 'Approved',
  [AFFILIATE_APPROVAL_STATUS.REJECTED]: 'Rejected',
};

export function getAffiliateApprovalLabel(status) {
  if (!status) return '—';
  return AFFILIATE_APPROVAL_LABELS[status] || status;
}

export function isAffiliatePending(status) {
  return AFFILIATE_PENDING_STATUSES.includes(status);
}
