export const AFFILIATE_TYPES = {
  STUDENT: 'student',
  SOCIAL_MEDIA_CREATOR: 'social_media_creator',
  FREELANCER_DIGITAL_MARKETER: 'freelancer_digital_marketer',
};

export const AFFILIATE_TYPE_OPTIONS = [
  {
    value: AFFILIATE_TYPES.STUDENT,
    label: 'Student',
  },
  {
    value: AFFILIATE_TYPES.SOCIAL_MEDIA_CREATOR,
    label: 'Social Media Creator and Influencer',
  },
  {
    value: AFFILIATE_TYPES.FREELANCER_DIGITAL_MARKETER,
    label: 'Freelancer and Digital Marketer',
  },
];

export const AFFILIATE_TYPE_VALUES = AFFILIATE_TYPE_OPTIONS.map((opt) => opt.value);

export const AFFILIATE_TYPE_LABELS = Object.fromEntries(
  AFFILIATE_TYPE_OPTIONS.map((opt) => [opt.value, opt.label])
);

export const VERIFICATION_DOC_KINDS = {
  STUDENT_ID: 'student_id',
  AADHAAR: 'aadhaar',
};

export const VERIFICATION_DOC_LABELS = {
  [VERIFICATION_DOC_KINDS.STUDENT_ID]: 'Student ID',
  [VERIFICATION_DOC_KINDS.AADHAAR]: 'Aadhaar card',
};

export function getAffiliateTypeLabel(value) {
  if (!value) return '—';
  return AFFILIATE_TYPE_LABELS[value] || value;
}

/** Students upload Student ID; all other affiliate types upload Aadhaar. */
export function getRequiredVerificationKind(affiliateType) {
  if (affiliateType === AFFILIATE_TYPES.STUDENT) {
    return VERIFICATION_DOC_KINDS.STUDENT_ID;
  }
  if (AFFILIATE_TYPE_VALUES.includes(affiliateType)) {
    return VERIFICATION_DOC_KINDS.AADHAAR;
  }
  return null;
}

export function getVerificationDocLabel(kindOrType) {
  if (!kindOrType) return '—';
  if (VERIFICATION_DOC_LABELS[kindOrType]) {
    return VERIFICATION_DOC_LABELS[kindOrType];
  }
  const kind = getRequiredVerificationKind(kindOrType);
  return kind ? VERIFICATION_DOC_LABELS[kind] : '—';
}

export function getAffiliateExtraSummary(user) {
  if (!user) return '—';
  const parts = [];

  if (user.affiliateType === AFFILIATE_TYPES.STUDENT) {
    if (user.collegeName) parts.push(`College: ${user.collegeName}`);
    if (user.universityName) parts.push(`University: ${user.universityName}`);
  } else if (user.affiliateType === AFFILIATE_TYPES.SOCIAL_MEDIA_CREATOR) {
    if (user.socialMediaAccount) parts.push(user.socialMediaAccount);
  } else if (user.affiliateType === AFFILIATE_TYPES.FREELANCER_DIGITAL_MARKETER) {
    if (user.resumeDocumentName) parts.push(`Resume: ${user.resumeDocumentName}`);
  }

  if (user.joinReason) {
    parts.push(`Why join: ${user.joinReason}`);
  }

  return parts.length ? parts.join(' · ') : '—';
}
