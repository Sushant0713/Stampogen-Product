const AFFILIATE_TYPES = {
  STUDENT: 'student',
  SOCIAL_MEDIA_CREATOR: 'social_media_creator',
  FREELANCER_DIGITAL_MARKETER: 'freelancer_digital_marketer',
};

const AFFILIATE_TYPE_OPTIONS = [
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

const AFFILIATE_TYPE_VALUES = AFFILIATE_TYPE_OPTIONS.map((opt) => opt.value);

const AFFILIATE_TYPE_LABELS = Object.fromEntries(
  AFFILIATE_TYPE_OPTIONS.map((opt) => [opt.value, opt.label])
);

const VERIFICATION_DOC_KINDS = {
  STUDENT_ID: 'student_id',
  AADHAAR: 'aadhaar',
};

const VERIFICATION_DOC_LABELS = {
  [VERIFICATION_DOC_KINDS.STUDENT_ID]: 'Student ID',
  [VERIFICATION_DOC_KINDS.AADHAAR]: 'Aadhaar card',
};

function getAffiliateTypeLabel(value) {
  if (!value) return '—';
  return AFFILIATE_TYPE_LABELS[value] || value;
}

function isValidAffiliateType(value) {
  return AFFILIATE_TYPE_VALUES.includes(value);
}

/** Students upload Student ID; all other affiliate types upload Aadhaar. */
function getRequiredVerificationKind(affiliateType) {
  if (affiliateType === AFFILIATE_TYPES.STUDENT) {
    return VERIFICATION_DOC_KINDS.STUDENT_ID;
  }
  if (isValidAffiliateType(affiliateType)) {
    return VERIFICATION_DOC_KINDS.AADHAAR;
  }
  return null;
}

function getVerificationDocLabel(kind) {
  if (!kind) return '—';
  return VERIFICATION_DOC_LABELS[kind] || kind;
}

function isValidDataFile(dataUrl, { allowImages = true, allowPdf = true } = {}) {
  if (!dataUrl || typeof dataUrl !== 'string') return false;
  const parts = [];
  if (allowImages) parts.push('image\\/(jpeg|jpg|png|webp)');
  if (allowPdf) parts.push('application\\/pdf');
  if (!parts.length) return false;
  const re = new RegExp(`^data:(${parts.join('|')});base64,`, 'i');
  if (!re.test(dataUrl.trim())) return false;
  const b64 = dataUrl.split(',')[1] || '';
  if (b64.length > 7 * 1024 * 1024) return false;
  return true;
}

function isValidVerificationDocument(dataUrl) {
  return isValidDataFile(dataUrl, { allowImages: true, allowPdf: true });
}

function isValidResumeDocument(dataUrl) {
  return isValidDataFile(dataUrl, { allowImages: true, allowPdf: true });
}

/**
 * Validate + normalize type-specific affiliate profile fields.
 * Returns { ok, error, data } where data is ready to persist.
 */
function buildAffiliateExtraFields(affiliateType, body = {}) {
  const collegeName = String(body.collegeName || '').trim();
  const universityName = String(body.universityName || '').trim();
  const socialMediaAccount = String(body.socialMediaAccount || '').trim();
  const resumeDocument = String(body.resumeDocument || '').trim();
  const resumeDocumentName = String(body.resumeDocumentName || '').trim().slice(0, 200);
  const joinReason = String(body.joinReason || '').trim();

  if (joinReason.length < 5) {
    return { ok: false, error: 'Please tell us why you want to join' };
  }

  const shared = {
    joinReason: joinReason.slice(0, 1000),
  };

  if (affiliateType === AFFILIATE_TYPES.STUDENT) {
    if (collegeName.length < 2) {
      return { ok: false, error: 'College is required' };
    }
    return {
      ok: true,
      data: {
        ...shared,
        collegeName: collegeName.slice(0, 200),
        universityName: universityName.slice(0, 200),
        socialMediaAccount: '',
        resumeDocument: null,
        resumeDocumentName: '',
      },
    };
  }

  if (affiliateType === AFFILIATE_TYPES.SOCIAL_MEDIA_CREATOR) {
    if (socialMediaAccount.length < 2) {
      return { ok: false, error: 'Social media account is required' };
    }
    return {
      ok: true,
      data: {
        ...shared,
        collegeName: '',
        universityName: '',
        socialMediaAccount: socialMediaAccount.slice(0, 300),
        resumeDocument: null,
        resumeDocumentName: '',
      },
    };
  }

  if (affiliateType === AFFILIATE_TYPES.FREELANCER_DIGITAL_MARKETER) {
    if (!isValidResumeDocument(resumeDocument)) {
      return { ok: false, error: 'Resume is required (JPG, PNG, WEBP, or PDF, max 5MB)' };
    }
    return {
      ok: true,
      data: {
        ...shared,
        collegeName: '',
        universityName: '',
        socialMediaAccount: '',
        resumeDocument,
        resumeDocumentName,
      },
    };
  }

  return { ok: false, error: 'Invalid affiliate type' };
}

module.exports = {
  AFFILIATE_TYPES,
  AFFILIATE_TYPE_OPTIONS,
  AFFILIATE_TYPE_VALUES,
  AFFILIATE_TYPE_LABELS,
  VERIFICATION_DOC_KINDS,
  VERIFICATION_DOC_LABELS,
  getAffiliateTypeLabel,
  isValidAffiliateType,
  getRequiredVerificationKind,
  getVerificationDocLabel,
  isValidDataFile,
  isValidVerificationDocument,
  isValidResumeDocument,
  buildAffiliateExtraFields,
};
