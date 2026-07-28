const crypto = require('crypto');
const AppError = require('@utils/AppError');
const { HTTP_STATUS } = require('@constants');
const { ROLES } = require('@constants/roles');
const { isValidDataFile } = require('@constants/affiliateTypes');
const { AFFILIATE_APPROVAL_STATUS } = require('@constants/affiliateApproval');
const UserRepository = require('@repositories/user.repository');
const { hashToken } = require('@utils/token');
const { sendAffiliateSignedAgreementUploadEmail } = require('@services/email.service');
const NotificationService = require('@services/notification.service');
const { affiliateDisplayName } = require('@helpers/agreementPdf.helper');
const config = require('@config');

const UPLOAD_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function assertIsAffiliate(user) {
  const roleSlug = user?.role?.slug || user?.role;
  if (roleSlug !== ROLES.AFFILIATE) {
    throw new AppError('User is not an affiliate', HTTP_STATUS.BAD_REQUEST);
  }
}

class AffiliateOnboardingService {
  /**
   * Create (or rotate) a one-time upload token. Returns { uploadUrl, expiresAt }.
   * When clearPreviousUpload is true, allows a fresh upload after a wrong document.
   */
  async issueUploadToken(id, { clearPreviousUpload = false } = {}) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + UPLOAD_TOKEN_TTL_MS);

    const patch = {
      signedAgreementUploadTokenHash: hashToken(rawToken),
      signedAgreementUploadExpiresAt: expiresAt,
      signedAgreementOnboardingSentAt: new Date(),
    };

    if (clearPreviousUpload) {
      patch.signedAgreementUploadedAt = null;
    }

    await UserRepository.updateById(id, patch);

    return {
      rawToken,
      expiresAt,
      uploadUrl: `${config.frontendUrl}/affiliate/upload-agreement?token=${rawToken}`,
    };
  }

  /**
   * Super admin: resend upload link (e.g. after a wrong document).
   */
  async requestUploadLink(id) {
    const user = await UserRepository.findById(id);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }
    assertIsAffiliate(user);

    if (user.affiliateApprovalStatus !== AFFILIATE_APPROVAL_STATUS.ON_HOLD) {
      throw new AppError(
        'Upload link can only be sent while the application is on hold',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (!user.isEmailVerified) {
      throw new AppError('Affiliate email must be verified first', HTTP_STATUS.BAD_REQUEST);
    }

    const { uploadUrl, expiresAt } = await this.issueUploadToken(id, {
      clearPreviousUpload: true,
    });
    const updated = await UserRepository.findById(id);

    try {
      await sendAffiliateSignedAgreementUploadEmail({
        to: updated.email,
        name: affiliateDisplayName(updated),
        uploadUrl,
        expiresAt,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        '[requestUploadLink] Failed to email onboarding link:',
        error.message || error
      );
      throw new AppError(
        'Unable to send onboarding email. Check email settings and try again.',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    return updated;
  }

  async getUploadMeta(rawToken) {
    const token = String(rawToken || '').trim();
    if (!token || token.length < 32) {
      throw new AppError('Invalid or expired upload link', HTTP_STATUS.BAD_REQUEST);
    }

    const user = await UserRepository.findBySignedAgreementTokenHash(hashToken(token));
    if (!user) {
      throw new AppError(
        'This upload link is invalid, expired, or already used.',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (
      !user.signedAgreementUploadExpiresAt ||
      user.signedAgreementUploadExpiresAt.getTime() < Date.now()
    ) {
      throw new AppError(
        'This upload link has expired. Ask Stampogen to send a new onboarding email.',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (user.affiliateApprovalStatus !== AFFILIATE_APPROVAL_STATUS.ON_HOLD) {
      throw new AppError(
        'This application is no longer awaiting a signed agreement.',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (user.signedAgreementUploadedAt) {
      throw new AppError(
        'This upload link has already been used and is cancelled. Ask Stampogen to send a new onboarding email if you need to upload again.',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    return {
      firstName: user.firstName || '',
      email: user.email,
      expiresAt: user.signedAgreementUploadExpiresAt,
    };
  }

  async uploadSignedAgreement({ token: rawToken, document, documentName }) {
    const token = String(rawToken || '').trim();
    if (!token || token.length < 32) {
      throw new AppError(
        'This upload link is invalid, expired, or already used.',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const dataUrl = String(document || '').trim();
    if (!isValidDataFile(dataUrl, { allowImages: true, allowPdf: true })) {
      throw new AppError(
        'Upload a JPG, PNG, WEBP, or PDF file (max ~5MB)',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const name = String(documentName || 'signed-agreement').trim().slice(0, 200);

    const user = await UserRepository.findBySignedAgreementTokenHash(hashToken(token));
    if (!user) {
      throw new AppError(
        'This upload link is invalid, expired, or already used.',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (
      !user.signedAgreementUploadExpiresAt ||
      user.signedAgreementUploadExpiresAt.getTime() < Date.now()
    ) {
      throw new AppError(
        'This upload link has expired. Ask Stampogen to send a new onboarding email.',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (user.affiliateApprovalStatus !== AFFILIATE_APPROVAL_STATUS.ON_HOLD) {
      throw new AppError(
        'This application is no longer awaiting a signed agreement.',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (user.signedAgreementUploadedAt) {
      throw new AppError(
        'This upload link has already been used and is cancelled.',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const updated = await UserRepository.updateSignedAgreementUpload(user._id, {
      document: dataUrl,
      documentName: name || 'signed-agreement',
      uploadedAt: new Date(),
    });

    if (!updated) {
      throw new AppError('Unable to save signed agreement', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    const display = affiliateDisplayName(updated);
    try {
      await NotificationService.notifySuperAdmins({
        type: 'affiliate_signed_agreement',
        title: 'Signed agreement uploaded',
        message: `${display} uploaded a signed affiliate agreement.`,
        link: NotificationService.buildPendingPath(),
        meta: { userId: String(updated._id), email: updated.email },
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        '[uploadSignedAgreement] Failed to notify super admins:',
        error.message || error
      );
    }

    return {
      firstName: updated.firstName || '',
      uploadedAt: updated.signedAgreementUploadedAt,
    };
  }

  /**
   * Public: reveal issued login details via secure claim link from approval email.
   */
  async getCredentialsMeta(rawToken) {
    const token = String(rawToken || '').trim();
    if (!token || token.length < 32) {
      throw new AppError('Invalid or expired access link', HTTP_STATUS.BAD_REQUEST);
    }

    const user = await UserRepository.findByCredentialsClaimTokenHash(hashToken(token));
    if (!user) {
      throw new AppError(
        'This access link is invalid or has expired. Ask Stampogen to resend your login email.',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (
      !user.affiliateCredentialsClaimExpiresAt ||
      user.affiliateCredentialsClaimExpiresAt.getTime() < Date.now()
    ) {
      throw new AppError(
        'This access link has expired. Ask Stampogen to resend your login email.',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (user.affiliateApprovalStatus !== AFFILIATE_APPROVAL_STATUS.APPROVED) {
      throw new AppError('Affiliate account is not approved for login yet', HTTP_STATUS.BAD_REQUEST);
    }

    const password = user.affiliateIssuedPassword || '';
    if (!password) {
      throw new AppError(
        'Login details are not ready yet. Ask Stampogen to resend your login email.',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    return {
      email: user.email,
      name: affiliateDisplayName(user),
      temporaryPassword: password,
      discountCode: user.affiliateDiscountCode || '',
      discountPercent: user.affiliateDiscountPercent || 20,
      loginUrl: `${config.frontendUrl}/affiliate/login`,
      expiresAt: user.affiliateCredentialsClaimExpiresAt,
    };
  }
}

module.exports = new AffiliateOnboardingService();
