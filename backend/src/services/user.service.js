const AppError = require('@utils/AppError');
const { HTTP_STATUS } = require('@constants');
const { ROLES } = require('@constants/roles');
const {
  AFFILIATE_TYPE_VALUES,
  isValidAffiliateType,
  getRequiredVerificationKind,
  getVerificationDocLabel,
  isValidVerificationDocument,
  buildAffiliateExtraFields,
} = require('@constants/affiliateTypes');
const {
  AFFILIATE_APPROVAL_STATUS,
  AFFILIATE_PENDING_STATUSES,
} = require('@constants/affiliateApproval');
const UserRepository = require('@repositories/user.repository');
const RoleRepository = require('@repositories/role.repository');
const RefreshTokenRepository = require('@repositories/refreshToken.repository');
const {
  sendAffiliateInterviewEmail,
  sendAffiliateDecisionEmail,
  sendAffiliateLoginCredentialsEmail,
  sendAffiliateHoldAgreementEmail,
  buildSuperAdminInterviewEmail,
  formatInterviewAt,
} = require('@services/email.service');
const NotificationService = require('@services/notification.service');
const AgreementSettingsService = require('@services/agreementSettings.service');
const {
  buildAgreementPdfBuffer,
  buildAgreementPdfFileName,
  affiliateDisplayName,
} = require('@helpers/agreementPdf.helper');
const config = require('@config');
const crypto = require('crypto');
const {
  ensureAffiliatePartnerDiscount,
  syncAffiliatePartnerDiscountPercent,
} = require('@helpers/affiliateDiscount.helper');
const { hashToken } = require('@utils/token');

function clampPercentField(value, label) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n) || n < 0 || n > 100) {
    throw new AppError(`${label} must be between 0 and 100`, HTTP_STATUS.BAD_REQUEST);
  }
  return Math.round(n * 100) / 100;
}

function clampMoneyField(value, label) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) {
    throw new AppError(`${label} must be 0 or greater`, HTTP_STATUS.BAD_REQUEST);
  }
  return Math.round(n * 100) / 100;
}

function assertIsAffiliate(user) {
  const roleSlug = user?.role?.slug || user?.role;
  if (roleSlug !== ROLES.AFFILIATE) {
    throw new AppError('User is not an affiliate', HTTP_STATUS.BAD_REQUEST);
  }
}

/** Temporary password emailed on approval (meets register complexity rules). */
function generateAffiliateLoginPassword() {
  const token = crypto.randomBytes(4).toString('hex');
  return `Sp${token}9a`;
}

async function issueAffiliateCredentials(user, { isResend = false } = {}) {
  if (!user?.email) {
    throw new AppError('Affiliate email is missing', HTTP_STATUS.BAD_REQUEST);
  }

  const temporaryPassword = generateAffiliateLoginPassword();
  await UserRepository.updateCredentials(user._id, { password: temporaryPassword });
  await UserRepository.setAffiliateIssuedPassword(user._id, temporaryPassword);

  // Prefer fresh user fields (discount may have just been created)
  const fresh = await UserRepository.findById(user._id);
  const affiliateDiscountCode =
    fresh?.affiliateDiscountCode || user.affiliateDiscountCode || '';
  const affiliateDiscountPercent =
    fresh?.affiliateDiscountPercent || user.affiliateDiscountPercent || 20;

  // Secure claim link — college filters often drop mails that contain passwords inline
  const rawClaimToken = crypto.randomBytes(32).toString('hex');
  const claimExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await UserRepository.setCredentialsClaimToken(user._id, {
    tokenHash: hashToken(rawClaimToken),
    expiresAt: claimExpiresAt,
  });
  const claimUrl = `${config.frontendUrl}/affiliate/claim-access?token=${rawClaimToken}`;

  await sendAffiliateLoginCredentialsEmail({
    to: user.email,
    name: user.fullName || user.firstName || fresh?.firstName,
    email: user.email,
    isResend,
    affiliateDiscountCode,
    affiliateDiscountPercent,
    claimUrl,
    claimExpiresAt,
  });

  const plain =
    fresh && typeof fresh.toObject === 'function'
      ? fresh.toObject({ virtuals: true })
      : { ...(fresh || user) };

  delete plain.password;
  delete plain.verificationDocument;
  delete plain.resumeDocument;
  delete plain.signedAgreementDocument;
  delete plain.__v;

  return {
    ...plain,
    affiliateIssuedPassword: temporaryPassword,
    affiliateDiscountCode: affiliateDiscountCode || plain.affiliateDiscountCode || '',
    affiliateDiscountPercent:
      affiliateDiscountPercent || plain.affiliateDiscountPercent || 20,
  };
}

function isValidMeetLink(link) {
  const value = String(link || '').trim();
  if (!value || value.length > 500) return false;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    const host = url.hostname.toLowerCase();
    return (
      host === 'meet.google.com' ||
      host.endsWith('.google.com') ||
      host.includes('meet.google')
    );
  } catch {
    return false;
  }
}

function parseInterviewAt(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

class UserService {
  async getById(id) {
    const user = await UserRepository.findById(id, { includeVerificationDocument: true });
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const plain =
      typeof user.toObject === 'function'
        ? user.toObject({ virtuals: true })
        : { ...user };

    // Always load plaintext issued password for SA View (select:false can be dropped on serialize)
    const { User } = require('@models');
    const creds = await User.findById(id).select('+affiliateIssuedPassword').lean();
    plain.affiliateIssuedPassword = creds?.affiliateIssuedPassword || null;
    if (creds?.affiliateCredentialsIssuedAt) {
      plain.affiliateCredentialsIssuedAt = creds.affiliateCredentialsIssuedAt;
    }

    delete plain.password;
    delete plain.__v;
    return plain;
  }

  async getAll(filter, options) {
    return UserRepository.findAll(filter, options);
  }

  async getAffiliateStats() {
    return UserRepository.affiliateStats();
  }

  async createAffiliate(data) {
    const firstName = String(data.firstName || '').trim();
    const lastName = String(data.lastName || '').trim();
    const email = String(data.email || '').trim().toLowerCase();
    const phone = String(data.phone || '').trim();
    const affiliateType = String(data.affiliateType || '').trim();
    const verificationStatus = ['pending', 'verified', 'rejected'].includes(data.verificationStatus)
      ? data.verificationStatus
      : 'verified';
    const isActive = data.isActive !== false;

    if (!firstName || !lastName) {
      throw new AppError('First and last name are required', HTTP_STATUS.BAD_REQUEST);
    }
    if (!email) {
      throw new AppError('Email is required', HTTP_STATUS.BAD_REQUEST);
    }
    if (!isValidAffiliateType(affiliateType)) {
      throw new AppError('Affiliate type is required', HTTP_STATUS.BAD_REQUEST);
    }

    const AffiliateSettingsService = require('@services/affiliateSettings.service');
    await AffiliateSettingsService.assertTypeEnabled(affiliateType);

    const kind = getRequiredVerificationKind(affiliateType);
    const label = getVerificationDocLabel(kind);
    const verificationDocument = String(data.verificationDocument || '').trim();
    if (!isValidVerificationDocument(verificationDocument)) {
      throw new AppError(
        `${label} is required (JPG, PNG, WEBP, or PDF, max 5MB)`,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const extras = buildAffiliateExtraFields(affiliateType, data);
    if (!extras.ok) {
      throw new AppError(extras.error, HTTP_STATUS.BAD_REQUEST);
    }

    const existing = await UserRepository.findByEmail(email);
    if (existing) {
      throw new AppError('Email already registered', HTTP_STATUS.CONFLICT);
    }

    const role = await RoleRepository.findBySlug(ROLES.AFFILIATE);
    if (!role) {
      throw new AppError('Affiliate role not found. Please seed the database.', HTTP_STATUS.BAD_REQUEST);
    }

    const user = await UserRepository.create({
      firstName,
      lastName,
      email,
      phone,
      role: role._id,
      isEmailVerified: true,
      isActive,
      affiliateType,
      verificationDocumentKind: kind,
      verificationDocument,
      verificationDocumentName: String(data.verificationDocumentName || '')
        .trim()
        .slice(0, 200),
      verificationStatus,
      affiliateApprovalStatus: AFFILIATE_APPROVAL_STATUS.APPROVED,
      affiliateDecisionAt: new Date(),
      affiliateDecisionNote: 'Created by super admin',
      ...extras.data,
    });

    try {
      await ensureAffiliatePartnerDiscount(user);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        '[createAffiliate] Failed to create partner discount:',
        error.message || error
      );
    }

    try {
      return await issueAffiliateCredentials(await UserRepository.findById(user._id), {
        isResend: false,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[createAffiliate] Failed to email credentials:', error.message || error);
      const created = await UserRepository.findById(user._id);
      return created;
    }
  }

  async scheduleAffiliateInterview(id, { meetLink, interviewAt, note = '' }) {
    const user = await UserRepository.findById(id, { includeVerificationDocument: true });
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }
    assertIsAffiliate(user);

    const status = user.affiliateApprovalStatus;
    if (
      status &&
      status !== AFFILIATE_APPROVAL_STATUS.PENDING_REVIEW &&
      status !== AFFILIATE_APPROVAL_STATUS.ON_HOLD &&
      status !== AFFILIATE_APPROVAL_STATUS.INTERVIEW_SCHEDULED
    ) {
      throw new AppError(
        'Only pending affiliate applications can be scheduled for interview',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (!user.isEmailVerified) {
      throw new AppError('Affiliate email is not verified yet', HTTP_STATUS.BAD_REQUEST);
    }

    const link = String(meetLink || '').trim();
    if (!isValidMeetLink(link)) {
      throw new AppError(
        'Enter a valid Google Meet link (https://meet.google.com/...)',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const meetingAt = parseInterviewAt(interviewAt);
    if (!meetingAt) {
      throw new AppError('Interview date and time are required', HTTP_STATUS.BAD_REQUEST);
    }

    const minAllowed = Date.now() - 5 * 60 * 1000;
    if (meetingAt.getTime() < minAllowed) {
      throw new AppError('Interview time must be in the future', HTTP_STATUS.BAD_REQUEST);
    }

    const interviewNote = String(note || '').trim().slice(0, 1000);
    const updated = await UserRepository.updateById(id, {
      affiliateApprovalStatus: AFFILIATE_APPROVAL_STATUS.INTERVIEW_SCHEDULED,
      interviewMeetLink: link,
      interviewAt: meetingAt,
      interviewScheduledAt: new Date(),
      interviewNote,
      isActive: false,
    });

    const affiliateName = updated.fullName || updated.firstName || 'Affiliate';
    const whenLabel = formatInterviewAt(meetingAt);
    const pendingUrl = `${config.frontendUrl}/super-admin/affiliates/pending`;

    await sendAffiliateInterviewEmail({
      to: updated.email,
      name: affiliateName,
      meetLink: link,
      interviewAt: meetingAt,
      note: interviewNote,
    });

    const saEmail = buildSuperAdminInterviewEmail({
      affiliateName,
      affiliateEmail: updated.email,
      meetLink: link,
      interviewAt: meetingAt,
      pendingUrl,
    });

    await NotificationService.notifySuperAdmins({
      type: 'affiliate_interview_scheduled',
      title: 'Affiliate interview scheduled',
      message: `${affiliateName} · ${whenLabel}`,
      link: '/super-admin/affiliates/pending',
      meta: {
        affiliateId: String(updated._id),
        interviewAt: meetingAt.toISOString(),
        meetLink: link,
      },
      emailSubject: saEmail.subject,
      emailHtml: saEmail.html,
      emailText: saEmail.text,
    });

    return updated;
  }

  async holdAffiliate(id, { note = '' } = {}) {
    const user = await UserRepository.findById(id);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }
    assertIsAffiliate(user);

    const status = user.affiliateApprovalStatus;
    if (status === AFFILIATE_APPROVAL_STATUS.ON_HOLD) {
      throw new AppError('Affiliate application is already on hold', HTTP_STATUS.BAD_REQUEST);
    }
    if (
      status !== AFFILIATE_APPROVAL_STATUS.PENDING_REVIEW &&
      status !== AFFILIATE_APPROVAL_STATUS.INTERVIEW_SCHEDULED
    ) {
      throw new AppError(
        'Only pending applications can be put on hold',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const holdNote = String(note || '').trim().slice(0, 1000);

    const agreement = await AgreementSettingsService.get('affiliate');
    if (!agreement?.content?.trim()) {
      throw new AppError(
        'Affiliate agreement content is empty. Configure it under Settings → Terms and Conditions (Affiliate Partner) before holding.',
        HTTP_STATUS.BAD_REQUEST
      );
    }
    if (agreement.isActive === false) {
      throw new AppError(
        'Affiliate agreement is inactive. Activate it under Settings → Terms and Conditions before holding.',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    let pdfBuffer;
    try {
      pdfBuffer = await buildAgreementPdfBuffer({
        settings: agreement,
        affiliate: user,
      });
    } catch (error) {
      throw new AppError(
        'Unable to generate agreement PDF. Please try again.',
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    const updated = await UserRepository.updateById(id, {
      affiliateApprovalStatus: AFFILIATE_APPROVAL_STATUS.ON_HOLD,
      affiliateHoldNote: holdNote,
      affiliateHeldAt: new Date(),
      isActive: false,
    });

    const AffiliateOnboardingService = require('@services/affiliateOnboarding.service');
    let uploadUrl = '';
    let expiresAt = null;
    try {
      const tokenInfo = await AffiliateOnboardingService.issueUploadToken(id, {
        clearPreviousUpload: true,
      });
      uploadUrl = tokenInfo.uploadUrl;
      expiresAt = tokenInfo.expiresAt;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[holdAffiliate] Failed to create upload token:', error.message || error);
      throw new AppError(
        'Unable to create signed-agreement upload link. Please try again.',
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    try {
      const filename = buildAgreementPdfFileName(updated);
      await sendAffiliateHoldAgreementEmail({
        to: updated.email,
        name: affiliateDisplayName(updated),
        note: holdNote,
        agreementTitle: agreement.title || 'Affiliate Partner Agreement',
        uploadUrl,
        expiresAt,
        attachments: [
          {
            filename,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[holdAffiliate] Failed to email agreement PDF:', error.message || error);
      throw new AppError(
        'Application put on hold, but the agreement email could not be sent. Check email settings and retry from logs.',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    return UserRepository.findById(id);
  }

  async resumeAffiliate(id) {
    const user = await UserRepository.findById(id);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }
    assertIsAffiliate(user);

    if (user.affiliateApprovalStatus !== AFFILIATE_APPROVAL_STATUS.ON_HOLD) {
      throw new AppError('Affiliate application is not on hold', HTTP_STATUS.BAD_REQUEST);
    }

    const nextStatus =
      user.interviewMeetLink && user.interviewAt
        ? AFFILIATE_APPROVAL_STATUS.INTERVIEW_SCHEDULED
        : AFFILIATE_APPROVAL_STATUS.PENDING_REVIEW;

    return UserRepository.updateById(id, {
      affiliateApprovalStatus: nextStatus,
      isActive: false,
    });
  }

  async approveAffiliate(id, { note = '' } = {}) {
    const user = await UserRepository.findById(id);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }
    assertIsAffiliate(user);

    const status = user.affiliateApprovalStatus;
    if (status === AFFILIATE_APPROVAL_STATUS.APPROVED) {
      throw new AppError('Affiliate is already approved', HTTP_STATUS.BAD_REQUEST);
    }

    if (user.signedAgreementOnboardingSentAt && !user.signedAgreementUploadedAt) {
      throw new AppError(
        'Wait for the signed agreement upload before approving',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (status === AFFILIATE_APPROVAL_STATUS.PENDING_REVIEW) {
      throw new AppError(
        'Schedule an interview and send the Meet link before final approval',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const canApproveFromInterview =
      status === AFFILIATE_APPROVAL_STATUS.INTERVIEW_SCHEDULED;
    const canApproveFromHoldWithAgreement =
      status === AFFILIATE_APPROVAL_STATUS.ON_HOLD && Boolean(user.signedAgreementUploadedAt);

    if (!canApproveFromInterview && !canApproveFromHoldWithAgreement) {
      throw new AppError('Affiliate application is not awaiting a decision', HTTP_STATUS.BAD_REQUEST);
    }

    const decisionNote = String(note || '').trim().slice(0, 1000);

    await UserRepository.updateById(id, {
      affiliateApprovalStatus: AFFILIATE_APPROVAL_STATUS.APPROVED,
      isActive: true,
      isEmailVerified: true,
      verificationStatus: 'verified',
      affiliateDecisionAt: new Date(),
      affiliateDecisionNote: decisionNote,
    });

    const approvedUser = await UserRepository.findById(id);
    try {
      await ensureAffiliatePartnerDiscount(approvedUser);
    } catch (error) {
      // Do not block credentials email if discount creation fails
      // eslint-disable-next-line no-console
      console.error(
        '[approveAffiliate] Partner discount failed (continuing with email):',
        error.message || error
      );
    }

    try {
      return await issueAffiliateCredentials(await UserRepository.findById(id), {
        isResend: false,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[approveAffiliate] Failed to email credentials:', error.message || error);
      throw new AppError(
        'Affiliate approved, but the login credentials email could not be sent. Check email settings.',
        HTTP_STATUS.BAD_REQUEST
      );
    }
  }

  async resendAffiliateCredentials(id) {
    const user = await UserRepository.findById(id);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }
    assertIsAffiliate(user);

    if (user.affiliateApprovalStatus !== AFFILIATE_APPROVAL_STATUS.APPROVED) {
      throw new AppError(
        'Login credentials can only be resent for approved affiliates',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    try {
      if (!user.affiliateDiscountCode) {
        await ensureAffiliatePartnerDiscount(user);
      }
      return await issueAffiliateCredentials(user, { isResend: true });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        '[resendAffiliateCredentials] Failed to email credentials:',
        error.message || error
      );
      throw new AppError(
        'Unable to send login credentials email. Check email settings and try again.',
        HTTP_STATUS.BAD_REQUEST
      );
    }
  }

  async rejectAffiliate(id, { note = '', reason = '' } = {}) {
    const user = await UserRepository.findById(id);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }
    assertIsAffiliate(user);

    const status = user.affiliateApprovalStatus;
    if (status === AFFILIATE_APPROVAL_STATUS.REJECTED) {
      throw new AppError('Affiliate is already rejected', HTTP_STATUS.BAD_REQUEST);
    }
    if (status === AFFILIATE_APPROVAL_STATUS.APPROVED) {
      throw new AppError(
        'Cannot reject an already approved affiliate from this flow',
        HTTP_STATUS.BAD_REQUEST
      );
    }
    if (!AFFILIATE_PENDING_STATUSES.includes(status)) {
      throw new AppError('Affiliate application is not pending', HTTP_STATUS.BAD_REQUEST);
    }

    const decisionNote = String(reason || note || '').trim().slice(0, 1000);
    if (decisionNote.length < 5) {
      throw new AppError(
        'Rejection reason is required (at least 5 characters)',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const updated = await UserRepository.updateById(id, {
      affiliateApprovalStatus: AFFILIATE_APPROVAL_STATUS.REJECTED,
      isActive: false,
      affiliateDecisionAt: new Date(),
      affiliateDecisionNote: decisionNote,
    });

    await RefreshTokenRepository.deleteByUser(updated._id);

    await sendAffiliateDecisionEmail({
      to: updated.email,
      name: updated.fullName || updated.firstName,
      approved: false,
      note: decisionNote,
    });

    return updated;
  }

  async update(id, data) {
    const allowed = [
      'firstName',
      'lastName',
      'phone',
      'avatar',
      'isActive',
      'affiliateType',
      'collegeName',
      'universityName',
      'socialMediaAccount',
      'joinReason',
      'verificationStatus',
      'affiliateDiscountPercent',
      'affiliateEarningPercent',
      'affiliateMinimumTargetValue',
    ];
    const updateData = {};

    allowed.forEach((key) => {
      if (data[key] !== undefined) {
        updateData[key] = data[key];
      }
    });

    if (updateData.affiliateDiscountPercent !== undefined) {
      updateData.affiliateDiscountPercent = clampPercentField(
        updateData.affiliateDiscountPercent,
        'Partner discount'
      );
    }
    if (updateData.affiliateEarningPercent !== undefined) {
      updateData.affiliateEarningPercent = clampPercentField(
        updateData.affiliateEarningPercent,
        'Affiliate earning'
      );
    }
    if (updateData.affiliateMinimumTargetValue !== undefined) {
      updateData.affiliateMinimumTargetValue = clampMoneyField(
        updateData.affiliateMinimumTargetValue,
        'Minimum target'
      );
    }

    if (updateData.affiliateType !== undefined) {
      if (!AFFILIATE_TYPE_VALUES.includes(updateData.affiliateType)) {
        throw new AppError('Invalid affiliate type', HTTP_STATUS.BAD_REQUEST);
      }
      updateData.verificationDocumentKind = getRequiredVerificationKind(updateData.affiliateType);
    }

    const existing = await UserRepository.findById(id);
    if (!existing) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    if (updateData.isActive !== undefined) {
      const roleSlug = existing.role?.slug || existing.role;
      if (roleSlug === ROLES.AFFILIATE) {
        const status = existing.affiliateApprovalStatus;
        if (status && status !== AFFILIATE_APPROVAL_STATUS.APPROVED) {
          throw new AppError(
            'Activate or suspend is only available after the affiliate is approved',
            HTTP_STATUS.BAD_REQUEST
          );
        }
      }
    }

    const user = await UserRepository.updateById(id, updateData);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    if (
      updateData.affiliateDiscountPercent != null &&
      user.affiliateDiscountCode
    ) {
      await syncAffiliatePartnerDiscountPercent(user, updateData.affiliateDiscountPercent);
    }

    if (updateData.isActive === false) {
      await RefreshTokenRepository.deleteByUser(user._id);
    }

    return user;
  }

  /**
   * Portfolio of clients who joined via this affiliate's partner coupon.
   */
  async getAffiliateClients(id, { search = '' } = {}) {
    const affiliate = await UserRepository.findById(id);
    if (!affiliate) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const roleSlug = affiliate.role?.slug || affiliate.role;
    if (roleSlug !== ROLES.AFFILIATE) {
      throw new AppError('User is not an affiliate', HTTP_STATUS.BAD_REQUEST);
    }

    const AffiliateEarningsRepository = require('@repositories/affiliateEarnings.repository');
    const AffiliateSettingsService = require('@services/affiliateSettings.service');
    const { User, Tenant } = require('@models');

    const discountCode = String(affiliate.affiliateDiscountCode || '')
      .trim()
      .toUpperCase();

    const typeConfig = await AffiliateSettingsService.getTypeConfig(affiliate.affiliateType);
    const earningPercent = Math.min(
      100,
      Math.max(
        0,
        Number(
          affiliate.affiliateEarningPercent != null
            ? affiliate.affiliateEarningPercent
            : typeConfig?.earningPercent ?? typeConfig?.defaultDiscountPercent ?? 20
        ) || 20
      )
    );

    const grouped = discountCode
      ? await AffiliateEarningsRepository.groupClientsByDiscountCode(discountCode)
      : [];

    const emails = grouped
      .map((row) => String(row.customerEmail || row._id || '').trim().toLowerCase())
      .filter(Boolean);

    const owners = emails.length
      ? await User.find({ email: { $in: emails } })
          .select('firstName lastName email tenant phone')
          .lean()
      : [];
    const ownerByEmail = new Map(
      owners.map((u) => [String(u.email || '').trim().toLowerCase(), u])
    );

    const tenantIds = owners.map((u) => u.tenant).filter(Boolean);
    const tenants = tenantIds.length
      ? await Tenant.find({ _id: { $in: tenantIds } })
          .select('name status currentPlan createdAt owner')
          .lean()
      : [];
    const tenantById = new Map(tenants.map((t) => [String(t._id), t]));

    const q = String(search || '')
      .trim()
      .toLowerCase();

    const clients = [];
    for (const row of grouped) {
      const email = String(row.customerEmail || row._id || '')
        .trim()
        .toLowerCase();
      const owner = ownerByEmail.get(email) || null;
      const tenantId = owner?.tenant ? String(owner.tenant) : null;
      const tenant = tenantId ? tenantById.get(tenantId) : null;
      const taxableTotal = Math.round((Number(row.taxableTotal) || 0) * 100) / 100;
      const affiliateEarningTotal =
        Math.round(((taxableTotal * earningPercent) / 100) * 100) / 100;

      const client = {
        tenantId: tenant ? String(tenant._id) : null,
        tenantName: tenant?.name || '',
        tenantStatus: tenant?.status || null,
        ownerId: owner ? String(owner._id) : null,
        ownerName:
          owner
            ? [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim()
            : row.customerName || '',
        ownerEmail: email,
        ownerPhone: owner?.phone || '',
        planName: tenant?.currentPlan?.name || row.planName || '',
        discountCode: String(row.discountCode || discountCode).toUpperCase(),
        paymentCount: Number(row.paymentCount) || 0,
        listTotal: Math.round((Number(row.listTotal) || 0) * 100) / 100,
        discountTotal: Math.round((Number(row.discountTotal) || 0) * 100) / 100,
        taxableTotal,
        payableTotal: Math.round((Number(row.payableTotal) || 0) * 100) / 100,
        affiliateEarningTotal,
        firstPaidAt: row.firstPaidAt || null,
        lastPaidAt: row.lastPaidAt || null,
      };

      if (q) {
        const hay = [
          client.tenantName,
          client.ownerName,
          client.ownerEmail,
          client.planName,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) continue;
      }

      clients.push(client);
    }

    const summary = {
      clientCount: clients.length,
      paymentCount: clients.reduce((sum, c) => sum + c.paymentCount, 0),
      lifetimeTaxableRevenue: Math.round(
        clients.reduce((sum, c) => sum + c.taxableTotal, 0) * 100
      ) / 100,
      lifetimeAffiliateEarning: Math.round(
        clients.reduce((sum, c) => sum + c.affiliateEarningTotal, 0) * 100
      ) / 100,
      earningPercent,
    };

    return {
      affiliate: {
        id: String(affiliate._id),
        firstName: affiliate.firstName || '',
        lastName: affiliate.lastName || '',
        fullName:
          affiliate.fullName ||
          [affiliate.firstName, affiliate.lastName].filter(Boolean).join(' ').trim(),
        email: affiliate.email || '',
        affiliateType: affiliate.affiliateType || null,
        discountCode,
        affiliateDiscountPercent: affiliate.affiliateDiscountPercent ?? null,
        affiliateEarningPercent: earningPercent,
      },
      summary,
      clients,
    };
  }

  async delete(id) {
    const user = await UserRepository.findById(id);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const roleSlug = user.role?.slug || user.role;
    if (roleSlug === ROLES.SUPER_ADMIN) {
      throw new AppError('Cannot delete a super admin', HTTP_STATUS.FORBIDDEN);
    }

    await RefreshTokenRepository.deleteByUser(user._id);
    const OAuthRepository = require('@repositories/oauth.repository');
    await OAuthRepository.deleteByUser(user._id);
    await UserRepository.deleteById(id);
    return { deleted: true, id };
  }
}

module.exports = new UserService();
