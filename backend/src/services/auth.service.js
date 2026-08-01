const crypto = require('crypto');
const AppError = require('@utils/AppError');
const { HTTP_STATUS, TENANT_STATUS } = require('@constants');
const { ROLES, AUTHENTICATED_ROLES } = require('@constants/roles');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getRefreshTokenExpiry,
} = require('@utils/token');
const { slugify } = require('@helpers');
const { assertAccountAccess, assertAffiliateCanLogin } = require('@helpers/accountAccess.helper');
const config = require('@config');
const { OAuth2Client } = require('google-auth-library');
const UserRepository = require('@repositories/user.repository');
const RoleRepository = require('@repositories/role.repository');
const RefreshTokenRepository = require('@repositories/refreshToken.repository');
const TenantRepository = require('@repositories/tenant.repository');
const EmailOtpRepository = require('@repositories/emailOtp.repository');
const OAuthRepository = require('@repositories/oauth.repository');
const PendingAdminRegistrationRepository = require('@repositories/pendingAdminRegistration.repository');
const { sendOtpEmail } = require('@services/email.service');
const bcrypt = require('bcryptjs');
const { User } = require('@models');
const {
  AFFILIATE_APPROVAL_STATUS,
  isAffiliateApproved,
} = require('@constants/affiliateApproval');
const { getSubscriptionView, applyDuePendingPlan } = require('@helpers/billing.helper');

const googleClient = new OAuth2Client(config.google.clientId);

function assertSuperAdminSecretCode(secretCode, roleSlug) {
  if (roleSlug !== ROLES.SUPER_ADMIN) return;

  const expected = String(config.superAdminSecretCode || '');
  if (!expected) {
    throw new AppError(
      'Super Admin secret code is not configured on the server',
      HTTP_STATUS.SERVICE_UNAVAILABLE
    );
  }

  const provided = String(secretCode || '');
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);

  const matches =
    expectedBuf.length === providedBuf.length &&
    crypto.timingSafeEqual(expectedBuf, providedBuf);

  if (!matches) {
    throw new AppError('Invalid secret code', HTTP_STATUS.UNAUTHORIZED);
  }
}

function parseBirthDate(value) {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function assertRequiredIdentity({ firstName, middleName, lastName, birthDate, phone }, { requireBirthDate = false } = {}) {
  if (!String(firstName || '').trim()) {
    throw new AppError('First name is required', HTTP_STATUS.BAD_REQUEST);
  }
  if (!String(middleName || '').trim()) {
    throw new AppError('Middle name is required', HTTP_STATUS.BAD_REQUEST);
  }
  if (!String(lastName || '').trim()) {
    throw new AppError('Last name is required', HTTP_STATUS.BAD_REQUEST);
  }
  if (requireBirthDate && !parseBirthDate(birthDate)) {
    throw new AppError('Birth date is required', HTTP_STATUS.BAD_REQUEST);
  }
  if (String(phone || '').trim().length < 8) {
    throw new AppError('Mobile number is required', HTTP_STATUS.BAD_REQUEST);
  }
}

/** Promote due pendingPlan on the admin tenant, then return a fresh user doc. */
async function syncAdminPendingPlan(user) {
  if (!user) return user;
  const roleSlug = user.role?.slug || user.role;
  if (roleSlug !== ROLES.ADMIN) return user;

  const tenantId = user.tenant?._id || user.tenant;
  if (!tenantId) return user;

  const tenant =
    user.tenant && typeof user.tenant === 'object' && user.tenant.currentPlan !== undefined
      ? user.tenant
      : await TenantRepository.findById(tenantId);
  if (!tenant) return user;

  const { tenant: updated, applied } = applyDuePendingPlan(tenant);
  if (!applied) return user;

  await TenantRepository.updateById(tenantId, {
    currentPlan: updated.currentPlan,
    pendingPlan: updated.pendingPlan,
    billingHistory: updated.billingHistory,
  });

  return UserRepository.findById(user._id);
}

/** Attach subscription summary for admin users (login toast + My plan). */
function withSubscription(user) {
  if (!user) return user;
  const plain =
    typeof user.toObject === 'function' ? user.toObject({ virtuals: true }) : { ...user };
  const roleSlug = plain.role?.slug || plain.role;
  if (roleSlug === ROLES.ADMIN) {
    const subscription = getSubscriptionView(plain.tenant);
    plain.subscription = subscription;
    if (plain.tenant && typeof plain.tenant === 'object') {
      plain.tenant = {
        ...(typeof plain.tenant.toObject === 'function'
          ? plain.tenant.toObject()
          : plain.tenant),
        subscription,
      };
    }
  }
  delete plain.password;
  delete plain.__v;
  return plain;
}

function adminUserHasPlan(user) {
  if (!user) return false;
  const tenant = user.tenant && typeof user.tenant === 'object' ? user.tenant : null;
  const subscription = getSubscriptionView(tenant);
  return Boolean(subscription?.planName);
}

/** Remove legacy unpaid admin User+Tenant so payment-gated signup can proceed. */
async function removeUnpaidAdminAccount(user) {
  if (!user || (user.role?.slug || user.role) !== ROLES.ADMIN) return false;
  if (adminUserHasPlan(user)) return false;

  const tenantId = user.tenant?._id || user.tenant || null;
  await OAuthRepository.deleteByUser(user._id);
  await UserRepository.deleteById(user._id);
  if (tenantId) {
    await TenantRepository.deleteById(tenantId);
  }
  return true;
}

async function assertAdminEmailAvailableForSignup(email) {
  const existing = await UserRepository.findByEmail(email);
  if (!existing) return;

  if ((existing.role?.slug || existing.role) !== ROLES.ADMIN) {
    throw new AppError(
      'This email is already registered with a different portal',
      HTTP_STATUS.CONFLICT
    );
  }

  if (adminUserHasPlan(existing)) {
    throw new AppError('Email already registered. Please sign in instead.', HTTP_STATUS.CONFLICT);
  }

  await removeUnpaidAdminAccount(existing);
}

async function uniqueTenantSlug(baseName) {
  let base = slugify(baseName) || 'shop';
  let slug = base;
  let attempt = 0;
  while (await TenantRepository.findBySlug(slug)) {
    attempt += 1;
    slug = `${base}-${attempt}`;
  }
  return slug;
}

async function createTenantForAdmin(
  user,
  tenantName,
  status = TENANT_STATUS.PENDING,
  billingProfile = null,
  loyaltyStampMode = 'bill',
  category = '',
  customCategory = ''
) {
  if (!user?._id) {
    throw new AppError('Unable to create shop for this account', HTTP_STATUS.BAD_REQUEST);
  }

  const {
    LOYALTY_STAMP_MODES,
    LOYALTY_STAMP_MODE_VALUES,
    SHOP_CATEGORIES,
    SHOP_CATEGORY_VALUES,
  } = require('@constants');
  const { normalizeBillingProfile, hasBillingProfile } = require('@helpers/billingProfile.helper');
  const billing = normalizeBillingProfile(billingProfile || {});
  const stampMode = LOYALTY_STAMP_MODE_VALUES.includes(loyaltyStampMode)
    ? loyaltyStampMode
    : LOYALTY_STAMP_MODES.BILL;

  const resolvedCategory = String(category || '').trim();
  let categoryFields = null;
  if (resolvedCategory) {
    if (!SHOP_CATEGORY_VALUES.includes(resolvedCategory)) {
      throw new AppError('Invalid shop category', HTTP_STATUS.BAD_REQUEST);
    }
    const resolvedCustomCategory =
      resolvedCategory === SHOP_CATEGORIES.CUSTOM
        ? String(customCategory || '').trim().slice(0, 100)
        : '';
    if (resolvedCategory === SHOP_CATEGORIES.CUSTOM && resolvedCustomCategory.length < 2) {
      throw new AppError('Please enter your custom category', HTTP_STATUS.BAD_REQUEST);
    }
    categoryFields = {
      category: resolvedCategory,
      customCategory: resolvedCustomCategory,
    };
  }

  const nameFromInput = String(tenantName || '').trim();
  const name =
    nameFromInput ||
    `${[user.firstName, user.lastName].filter(Boolean).join(' ') || 'Shop'}'s Shop`;
  const existingId = user.tenant?._id || user.tenant || null;

  if (existingId && (await TenantRepository.existsById(existingId))) {
    const existing = await TenantRepository.findById(existingId);
    // Never overwrite a saved billing profile with empty registration defaults
    // (email verification calls this without address fields).
    const patch = {};
    if (nameFromInput) {
      patch.name = nameFromInput;
    }
    if (hasBillingProfile(billing)) {
      patch.billingProfile = billing;
      patch.loyaltyStampMode = stampMode;
    }
    if (categoryFields) {
      Object.assign(patch, categoryFields);
    }
    if (Object.keys(patch).length) {
      return TenantRepository.updateById(existingId, patch);
    }
    return existing;
  }

  if (!categoryFields) {
    throw new AppError('Shop category is required', HTTP_STATUS.BAD_REQUEST);
  }

  const payload = {
    name,
    slug: await uniqueTenantSlug(name),
    owner: user._id,
    status,
    billingProfile: billing,
    loyaltyStampMode: stampMode,
    ...categoryFields,
  };
  if (existingId) payload._id = existingId;

  let tenant;
  try {
    tenant = await TenantRepository.create(payload);
  } catch (error) {
    delete payload._id;
    payload.slug = await uniqueTenantSlug(`${name}-${String(user._id).slice(-4)}`);
    try {
      tenant = await TenantRepository.create(payload);
    } catch (retryError) {
      throw new AppError(
        retryError.message || 'Unable to create shop organization',
        HTTP_STATUS.BAD_REQUEST
      );
    }
  }

  if (!tenant?._id) {
    throw new AppError('Unable to create shop organization', HTTP_STATUS.BAD_REQUEST);
  }

  const userPatch = { tenant: tenant._id };
  if (billing.phone) userPatch.phone = billing.phone;
  await UserRepository.updateById(user._id, userPatch);
  return tenant;
}

class AuthService {
  buildTokenPayload(user) {
    const roleSlug = user?.role?.slug;
    if (!roleSlug) {
      throw new AppError('User role is missing. Please contact support.', HTTP_STATUS.BAD_REQUEST);
    }

    return {
      sub: user._id.toString(),
      email: user.email,
      role: roleSlug,
      tenant: user.tenant?._id?.toString() || null,
    };
  }

  generateOtpCode() {
    const max = 10 ** config.otp.length;
    const code = crypto.randomInt(0, max).toString().padStart(config.otp.length, '0');
    return code;
  }

  async createAndSendOtp(email, purpose = 'email_verification') {
    const code = this.generateOtpCode();
    const expiresAt = new Date(Date.now() + config.otp.expiresMinutes * 60 * 1000);

    await EmailOtpRepository.upsert({
      email,
      code,
      purpose,
      expiresAt,
    });

    await sendOtpEmail({ to: email, code, purpose });

    return {
      email,
      expiresInMinutes: config.otp.expiresMinutes,
      preview: !config.smtp.host || !config.smtp.user,
    };
  }

  /**
   * Admin signup: store draft only (no User). Account is created after payment.
   */
  async saveAdminPendingRegistration({
    firstName,
    middleName,
    lastName,
    email,
    password = '',
    googleId = null,
    avatar = null,
    phone = '',
    tenantName,
    loyaltyStampMode = 'bill',
    category = '',
    customCategory = '',
    billingProfile = null,
    planCode = '',
    discountCode = '',
    emailVerified = false,
  }) {
    const normalizedEmail = String(email || '')
      .trim()
      .toLowerCase();
    await assertAdminEmailAvailableForSignup(normalizedEmail);

    const { normalizeBillingProfile } = require('@helpers/billingProfile.helper');
    const {
      LOYALTY_STAMP_MODES,
      LOYALTY_STAMP_MODE_VALUES,
      SHOP_CATEGORIES,
      SHOP_CATEGORY_VALUES,
    } = require('@constants');

    const billing = normalizeBillingProfile(billingProfile || { phone });
    if (!billing.phone) {
      throw new AppError('Phone number is required', HTTP_STATUS.BAD_REQUEST);
    }
    if (!billing.street && !billing.address) {
      throw new AppError('Street address is required', HTTP_STATUS.BAD_REQUEST);
    }
    if (!billing.state) {
      throw new AppError('State is required', HTTP_STATUS.BAD_REQUEST);
    }
    if (!billing.city) {
      throw new AppError('City is required', HTTP_STATUS.BAD_REQUEST);
    }
    if (!/^\d{6}$/.test(billing.pin || '')) {
      throw new AppError('Valid 6-digit PIN code is required', HTTP_STATUS.BAD_REQUEST);
    }

    const resolvedTenantName = String(tenantName || '').trim();
    if (resolvedTenantName.length < 2) {
      throw new AppError('Tenant name is required for admin registration', HTTP_STATUS.BAD_REQUEST);
    }

    const resolvedCategory = String(category || '').trim();
    if (!SHOP_CATEGORY_VALUES.includes(resolvedCategory)) {
      throw new AppError('Invalid shop category', HTTP_STATUS.BAD_REQUEST);
    }
    const resolvedCustomCategory =
      resolvedCategory === SHOP_CATEGORIES.CUSTOM
        ? String(customCategory || '').trim().slice(0, 100)
        : '';
    if (resolvedCategory === SHOP_CATEGORIES.CUSTOM && resolvedCustomCategory.length < 2) {
      throw new AppError('Please enter your custom category', HTTP_STATUS.BAD_REQUEST);
    }

    const stampMode = LOYALTY_STAMP_MODE_VALUES.includes(loyaltyStampMode)
      ? loyaltyStampMode
      : LOYALTY_STAMP_MODES.BILL;

    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(String(password), 12);
    }
    if (!passwordHash && !googleId) {
      throw new AppError('Password is required', HTTP_STATUS.BAD_REQUEST);
    }

    const draft = await PendingAdminRegistrationRepository.upsertByEmail(normalizedEmail, {
      passwordHash,
      googleId: googleId || null,
      avatar: avatar || null,
      firstName: String(firstName || '').trim(),
      middleName: String(middleName || '').trim(),
      lastName: String(lastName || '').trim(),
      phone: billing.phone,
      tenantName: resolvedTenantName,
      loyaltyStampMode: stampMode,
      category: resolvedCategory,
      customCategory: resolvedCustomCategory,
      billingProfile: billing,
      planCode: String(planCode || '').trim().toLowerCase(),
      discountCode: String(discountCode || '').trim().toUpperCase(),
      emailVerifiedAt: null,
      registrationTokenHash: null,
      registrationTokenExpiresAt: null,
    });

    if (emailVerified) {
      const issued = await PendingAdminRegistrationRepository.issueRegistrationToken(draft._id);
      return {
        requiresPayment: true,
        registrationToken: issued.registrationToken,
        profile: PendingAdminRegistrationRepository.toPublicView(issued.draft),
        message: 'Continue to checkout to complete registration',
      };
    }

    const otpMeta = await this.createAndSendOtp(normalizedEmail, 'email_verification');
    return {
      requiresVerification: true,
      message: 'Verification code sent to your email',
      ...otpMeta,
    };
  }

  /** Create the real admin User + Tenant from a verified pending draft (after payment). */
  async createAdminAccountFromPending(pending) {
    if (!pending?._id || !pending.email) {
      throw new AppError('Registration draft not found', HTTP_STATUS.BAD_REQUEST);
    }

    await assertAdminEmailAvailableForSignup(pending.email);

    const role = await RoleRepository.findBySlug(ROLES.ADMIN);
    if (!role) {
      throw new AppError('Role not found. Please seed the database.', HTTP_STATUS.BAD_REQUEST);
    }

    const draft =
      pending.passwordHash !== undefined
        ? pending
        : await PendingAdminRegistrationRepository.findById(pending._id, { withSecrets: true });

    let user;
    try {
      user = await UserRepository.create({
        firstName: draft.firstName,
        middleName: draft.middleName || '',
        lastName: draft.lastName,
        email: draft.email,
        ...(draft.googleId ? { googleId: draft.googleId } : {}),
        avatar: draft.avatar || null,
        role: role._id,
        isEmailVerified: true,
        isActive: true,
        phone: draft.phone || draft.billingProfile?.phone || '',
      });
    } catch (error) {
      if (error?.code === 11000) {
        throw new AppError('Email already registered. Please sign in instead.', HTTP_STATUS.CONFLICT);
      }
      throw error;
    }

    if (draft.passwordHash) {
      await User.updateOne({ _id: user._id }, { $set: { password: draft.passwordHash } });
    }

    if (draft.googleId) {
      try {
        await OAuthRepository.create({
          provider: 'google',
          providerId: draft.googleId,
          user: user._id,
        });
      } catch (error) {
        if (error?.code !== 11000) {
          throw new AppError(
            error.message || 'Unable to link Google account',
            HTTP_STATUS.BAD_REQUEST
          );
        }
      }
    }

    user = await UserRepository.findById(user._id);
    await createTenantForAdmin(
      user,
      draft.tenantName,
      TENANT_STATUS.ACTIVE,
      draft.billingProfile,
      draft.loyaltyStampMode,
      draft.category,
      draft.customCategory
    );

    await PendingAdminRegistrationRepository.deleteById(draft._id);
    return UserRepository.findById(user._id);
  }

  async getRegistrationDraftByToken(registrationToken) {
    const draft = await PendingAdminRegistrationRepository.findByValidToken(registrationToken);
    if (!draft) {
      throw new AppError(
        'Registration session expired. Please register again.',
        HTTP_STATUS.UNAUTHORIZED
      );
    }
    return PendingAdminRegistrationRepository.toPublicView(draft);
  }

  async issueTokens(user) {
    const syncedUser = await syncAdminPendingPlan(user);
    const payload = this.buildTokenPayload(syncedUser);
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await RefreshTokenRepository.create({
      user: syncedUser._id,
      token: refreshToken,
      expiresAt: getRefreshTokenExpiry(),
    });

    await UserRepository.updateLastLogin(syncedUser._id);

    return { accessToken, refreshToken, user: withSubscription(syncedUser) };
  }

  async register({
    firstName,
    middleName,
    lastName,
    birthDate,
    email,
    password,
    role: roleSlug,
    tenantName,
    loyaltyStampMode,
    category,
    customCategory,
    phone,
    address,
    street,
    city,
    state,
    pin,
    gstin,
    pan,
    affiliateType,
    verificationDocument,
    verificationDocumentName,
    collegeName,
    universityName,
    socialMediaAccount,
    resumeDocument,
    resumeDocumentName,
    joinReason,
    secretCode = '',
    planCode = '',
    discountCode = '',
  }) {
    if (!AUTHENTICATED_ROLES.includes(roleSlug)) {
      throw new AppError('Invalid role for registration', HTTP_STATUS.BAD_REQUEST);
    }

    assertSuperAdminSecretCode(secretCode, roleSlug);

    assertRequiredIdentity({ firstName, middleName, lastName, phone });
    const resolvedBirthDate = parseBirthDate(birthDate);
    const resolvedPhone = String(phone || '').trim();
    const resolvedMiddleName = String(middleName || '').trim();

    const { normalizeBillingProfile } = require('@helpers/billingProfile.helper');
    const {
      isValidAffiliateType,
      getRequiredVerificationKind,
      getVerificationDocLabel,
      isValidVerificationDocument,
      buildAffiliateExtraFields,
    } = require('@constants/affiliateTypes');
    const billingProfile =
      roleSlug === ROLES.ADMIN
        ? normalizeBillingProfile({ phone: resolvedPhone, address, street, city, state, pin, gstin, pan })
        : null;

    const resolvedAffiliateType =
      roleSlug === ROLES.AFFILIATE && isValidAffiliateType(String(affiliateType || '').trim())
        ? String(affiliateType).trim()
        : null;

    let affiliateVerification = null;
    if (roleSlug === ROLES.AFFILIATE) {
      if (!resolvedAffiliateType) {
        throw new AppError('Affiliate type is required', HTTP_STATUS.BAD_REQUEST);
      }
      const AffiliateSettingsService = require('@services/affiliateSettings.service');
      await AffiliateSettingsService.assertTypeEnabled(resolvedAffiliateType);
      const kind = getRequiredVerificationKind(resolvedAffiliateType);
      const label = getVerificationDocLabel(kind);
      const document = String(verificationDocument || '').trim();
      if (!isValidVerificationDocument(document)) {
        throw new AppError(
          `${label} is required (JPG, PNG, WEBP, or PDF, max 5MB)`,
          HTTP_STATUS.BAD_REQUEST
        );
      }
      const extras = buildAffiliateExtraFields(resolvedAffiliateType, {
        collegeName,
        universityName,
        socialMediaAccount,
        resumeDocument,
        resumeDocumentName,
        joinReason,
      });
      if (!extras.ok) {
        throw new AppError(extras.error, HTTP_STATUS.BAD_REQUEST);
      }
      affiliateVerification = {
        affiliateType: resolvedAffiliateType,
        verificationDocumentKind: kind,
        verificationDocument: document,
        verificationDocumentName: String(verificationDocumentName || '').trim().slice(0, 200),
        verificationStatus: 'pending',
        affiliateApprovalStatus: AFFILIATE_APPROVAL_STATUS.PENDING_REVIEW,
        ...extras.data,
      };
    }

    if (roleSlug === ROLES.ADMIN) {
      return this.saveAdminPendingRegistration({
        firstName,
        middleName: resolvedMiddleName,
        lastName,
        email,
        password,
        phone: resolvedPhone,
        tenantName,
        loyaltyStampMode,
        category,
        customCategory,
        billingProfile,
        planCode,
        discountCode,
        emailVerified: false,
      });
    }

    const existing = await UserRepository.findByEmail(email);
    if (existing) {
      if (existing.isEmailVerified) {
        if (existing.googleId) {
          throw new AppError(
            'This email is already registered with Google. Please sign in with Google.',
            HTTP_STATUS.CONFLICT
          );
        }
        throw new AppError('Email already registered. Please sign in instead.', HTTP_STATUS.CONFLICT);
      }

      await UserRepository.updateCredentials(existing._id, {
        firstName,
        middleName: resolvedMiddleName,
        lastName,
        birthDate: resolvedBirthDate,
        ...(roleSlug !== ROLES.AFFILIATE && password ? { password } : {}),
        phone: billingProfile?.phone || resolvedPhone || existing.phone || '',
      });

      if (affiliateVerification) {
        await UserRepository.updateById(existing._id, affiliateVerification);
      }

      if (roleSlug === ROLES.ADMIN && tenantName) {
        await createTenantForAdmin(
          await UserRepository.findById(existing._id),
          tenantName,
          TENANT_STATUS.PENDING,
          billingProfile,
          loyaltyStampMode,
          category,
          customCategory
        );
      }

      const otpMeta = await this.createAndSendOtp(email, 'email_verification');

      return {
        requiresVerification: true,
        message: 'Verification code sent to your email',
        ...otpMeta,
      };
    }

    const role = await RoleRepository.findBySlug(roleSlug);
    if (!role) {
      throw new AppError('Role not found. Please seed the database.', HTTP_STATUS.BAD_REQUEST);
    }

    if (roleSlug === ROLES.ADMIN) {
      if (!tenantName) {
        throw new AppError('Tenant name is required for admin registration', HTTP_STATUS.BAD_REQUEST);
      }
    }

    const user = await UserRepository.create({
      firstName,
      middleName: resolvedMiddleName,
      lastName,
      birthDate: resolvedBirthDate,
      email,
      ...(roleSlug !== ROLES.AFFILIATE && password ? { password } : {}),
      role: role._id,
      isEmailVerified: false,
      isActive: false,
      phone: billingProfile?.phone || resolvedPhone || '',
      ...(affiliateVerification || {}),
    });

    if (roleSlug === ROLES.ADMIN && tenantName) {
      await createTenantForAdmin(
        user,
        tenantName,
        TENANT_STATUS.PENDING,
        billingProfile,
        loyaltyStampMode,
        category,
        customCategory
      );
    }

    const otpMeta = await this.createAndSendOtp(email, 'email_verification');

    return {
      requiresVerification: true,
      message: 'Account created. Please verify your email with the OTP sent.',
      ...otpMeta,
    };
  }

  async verifyEmailOtp({ email, code, role: expectedRole }) {
    const otp = await EmailOtpRepository.findValid(email, 'email_verification');

    if (!otp) {
      throw new AppError('OTP expired or not found. Please request a new code.', HTTP_STATUS.BAD_REQUEST);
    }

    if (otp.attempts >= config.otp.maxAttempts) {
      await EmailOtpRepository.deleteByEmail(email, 'email_verification');
      throw new AppError('Too many invalid attempts. Please request a new code.', HTTP_STATUS.TOO_MANY_REQUESTS);
    }

    if (otp.code !== String(code).trim()) {
      await EmailOtpRepository.incrementAttempts(otp._id);
      throw new AppError('Invalid verification code', HTTP_STATUS.BAD_REQUEST);
    }

    // Payment-gated admin signup: draft exists, no User yet
    const pending = await PendingAdminRegistrationRepository.findByEmail(email, {
      withSecrets: true,
    });
    if (pending && (!expectedRole || expectedRole === ROLES.ADMIN)) {
      await EmailOtpRepository.deleteByEmail(email, 'email_verification');
      const issued = await PendingAdminRegistrationRepository.issueRegistrationToken(pending._id);
      return {
        requiresPayment: true,
        registrationToken: issued.registrationToken,
        profile: PendingAdminRegistrationRepository.toPublicView(issued.draft),
        message: 'Email verified. Complete payment to finish registration.',
      };
    }

    const user = await UserRepository.findByEmail(email);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    if (expectedRole && user.role.slug !== expectedRole) {
      throw new AppError('Access denied for this portal', HTTP_STATUS.FORBIDDEN);
    }

    await EmailOtpRepository.deleteByEmail(email, 'email_verification');

    const isAffiliate =
      user.role?.slug === ROLES.AFFILIATE || expectedRole === ROLES.AFFILIATE;

    if (isAffiliate) {
      const updatedUser = await UserRepository.updateById(user._id, {
        isEmailVerified: true,
        isActive: false,
        affiliateApprovalStatus:
          user.affiliateApprovalStatus || AFFILIATE_APPROVAL_STATUS.PENDING_REVIEW,
      });

      try {
        const NotificationService = require('@services/notification.service');
        const name = updatedUser.fullName || updatedUser.firstName || 'Affiliate';
        await NotificationService.notifySuperAdmins({
          type: 'affiliate_pending_review',
          title: 'New affiliate application',
          message: `${name} (${updatedUser.email}) is waiting for review`,
          link: '/super-admin/affiliates/pending',
          meta: { affiliateId: String(updatedUser._id) },
        });
      } catch {
        // Non-blocking
      }

      return {
        requiresApproval: true,
        message:
          'Email verified. Your affiliate application is pending review. You can sign in after approval.',
        email: updatedUser.email,
        user: updatedUser,
      };
    }

    const updatedUser = await UserRepository.updateById(user._id, {
      isEmailVerified: true,
      isActive: true,
    });

    if (updatedUser.role?.slug === ROLES.ADMIN || expectedRole === ROLES.ADMIN) {
      const tenantId = updatedUser.tenant?._id || updatedUser.tenant || null;
      if (tenantId && (await TenantRepository.existsById(tenantId))) {
        // Activate only — do not recreate/patch billing (address was saved at register)
        await TenantRepository.updateById(tenantId, { status: TENANT_STATUS.ACTIVE });
      } else {
        const tenant = await createTenantForAdmin(updatedUser, null, TENANT_STATUS.ACTIVE);
        if (tenant?._id) {
          await TenantRepository.updateById(tenant._id, { status: TENANT_STATUS.ACTIVE });
        }
      }
    } else if (updatedUser.tenant?._id || updatedUser.tenant) {
      const tenantId = updatedUser.tenant._id || updatedUser.tenant;
      if (await TenantRepository.existsById(tenantId)) {
        await TenantRepository.updateById(tenantId, { status: TENANT_STATUS.ACTIVE });
      }
    }

    return this.issueTokens(await UserRepository.findById(user._id));
  }

  async resendOtp({ email, purpose = 'email_verification', role: expectedRole }) {
    const pending =
      purpose === 'email_verification' && (!expectedRole || expectedRole === ROLES.ADMIN)
        ? await PendingAdminRegistrationRepository.findByEmail(email)
        : null;

    if (pending) {
      const otpMeta = await this.createAndSendOtp(email, purpose);
      return {
        message: 'Verification code resent',
        ...otpMeta,
      };
    }

    const user = await UserRepository.findByEmail(email);

    if (!user) {
      throw new AppError('No account found. Please register first.', HTTP_STATUS.NOT_FOUND);
    }

    if (expectedRole && user.role.slug !== expectedRole) {
      throw new AppError('Access denied for this portal', HTTP_STATUS.FORBIDDEN);
    }

    if (purpose === 'email_verification' && user.isEmailVerified) {
      throw new AppError('Email is already verified', HTTP_STATUS.BAD_REQUEST);
    }

    if (purpose === 'login' && !user.isEmailVerified) {
      throw new AppError('Email is not verified', HTTP_STATUS.BAD_REQUEST);
    }

    const otpMeta = await this.createAndSendOtp(email, purpose);

    return {
      message: 'Verification code resent',
      ...otpMeta,
    };
  }

  async requestLoginOtp({ email, expectedRole }) {
    const user = await UserRepository.findByEmail(email);

    if (!user) {
      throw new AppError('No account found. Please register first.', HTTP_STATUS.NOT_FOUND);
    }

    if (expectedRole && user.role.slug !== expectedRole) {
      throw new AppError('Access denied for this portal', HTTP_STATUS.FORBIDDEN);
    }

    if (user.role.slug === ROLES.USER) {
      throw new AppError('User role authentication is not available', HTTP_STATUS.FORBIDDEN);
    }

    if (!user.isEmailVerified) {
      await this.createAndSendOtp(email, 'email_verification');
      const error = new AppError(
        'Email not verified. A new OTP has been sent to your email.',
        HTTP_STATUS.FORBIDDEN
      );
      error.code = 'EMAIL_NOT_VERIFIED';
      error.email = email;
      throw error;
    }

    assertAffiliateCanLogin(user, { forLogin: true });

    if (!user.isActive) {
      throw new AppError('Account is inactive', HTTP_STATUS.FORBIDDEN);
    }

    assertAccountAccess(user, { forLogin: true });

    const otpMeta = await this.createAndSendOtp(email, 'login');

    return {
      message: 'Login code sent to your email',
      requiresOtp: true,
      ...otpMeta,
    };
  }

  async verifyLoginOtp({ email, code, role: expectedRole }) {
    const otp = await EmailOtpRepository.findValid(email, 'login');

    if (!otp) {
      throw new AppError('OTP expired or not found. Please request a new code.', HTTP_STATUS.BAD_REQUEST);
    }

    if (otp.attempts >= config.otp.maxAttempts) {
      await EmailOtpRepository.deleteByEmail(email, 'login');
      throw new AppError('Too many invalid attempts. Please request a new code.', HTTP_STATUS.TOO_MANY_REQUESTS);
    }

    if (otp.code !== String(code).trim()) {
      await EmailOtpRepository.incrementAttempts(otp._id);
      throw new AppError('Invalid verification code', HTTP_STATUS.BAD_REQUEST);
    }

    const user = await UserRepository.findByEmail(email);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    if (expectedRole && user.role.slug !== expectedRole) {
      throw new AppError('Access denied for this portal', HTTP_STATUS.FORBIDDEN);
    }

    assertAffiliateCanLogin(user, { forLogin: true });

    if (!user.isActive || !user.isEmailVerified) {
      throw new AppError('Account is inactive or not verified', HTTP_STATUS.FORBIDDEN);
    }

    assertAccountAccess(user, { forLogin: true });
    await EmailOtpRepository.deleteByEmail(email, 'login');

    return this.issueTokens(user);
  }

  async login({ email, password, expectedRole, secretCode }) {
    const user = await UserRepository.findByEmailWithPassword(email);

    if (!user) {
      throw new AppError('No account found. Please register first.', HTTP_STATUS.NOT_FOUND);
    }

    if (!(await user.comparePassword(password))) {
      throw new AppError('Invalid email or password', HTTP_STATUS.UNAUTHORIZED);
    }

    if (expectedRole && user.role.slug !== expectedRole) {
      throw new AppError('Access denied for this portal', HTTP_STATUS.FORBIDDEN);
    }

    assertSuperAdminSecretCode(secretCode, expectedRole || user.role?.slug);

    if (user.role.slug === ROLES.USER) {
      throw new AppError('User role authentication is not available', HTTP_STATUS.FORBIDDEN);
    }

    if (!user.isEmailVerified) {
      await this.createAndSendOtp(email, 'email_verification');
      const error = new AppError(
        'Email not verified. A new OTP has been sent to your email.',
        HTTP_STATUS.FORBIDDEN
      );
      error.code = 'EMAIL_NOT_VERIFIED';
      error.email = email;
      throw error;
    }

    assertAffiliateCanLogin(user, { forLogin: true });

    if (!user.isActive) {
      throw new AppError('Account is inactive', HTTP_STATUS.FORBIDDEN);
    }

    const fullUser = await UserRepository.findById(user._id);
    assertAccountAccess(fullUser, { forLogin: true });

    if (fullUser.role?.slug === ROLES.ADMIN && !adminUserHasPlan(fullUser)) {
      await removeUnpaidAdminAccount(fullUser);
      throw new AppError(
        'No account found. Please register and complete payment first.',
        HTTP_STATUS.NOT_FOUND
      );
    }

    return this.issueTokens(fullUser);
  }

  async refresh(refreshToken) {
    if (!refreshToken) {
      throw new AppError('Refresh token required', HTTP_STATUS.UNAUTHORIZED);
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError('Invalid or expired refresh token', HTTP_STATUS.UNAUTHORIZED);
    }

    const stored = await RefreshTokenRepository.findByToken(refreshToken);
    if (!stored) {
      throw new AppError('Refresh token revoked', HTTP_STATUS.UNAUTHORIZED);
    }

    await RefreshTokenRepository.deleteByToken(refreshToken);

    const user = await UserRepository.findById(decoded.sub);
    if (!user || !user.isActive) {
      throw new AppError('User not found or inactive', HTTP_STATUS.UNAUTHORIZED);
    }

    assertAccountAccess(user);
    return this.issueTokens(user);
  }

  async logout(refreshToken, userId) {
    if (refreshToken) {
      await RefreshTokenRepository.deleteByToken(refreshToken);
    } else if (userId) {
      await RefreshTokenRepository.deleteByUser(userId);
    }
  }

  async getMe(userId) {
    let user = await UserRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }
    assertAccountAccess(user);
    user = await syncAdminPendingPlan(user);
    return withSubscription(user);
  }

  async findOrCreateGoogleUser({
    profile,
    roleSlug,
    allowCreate = false,
    tenantName = '',
    loyaltyStampMode = '',
    category = '',
    customCategory = '',
    firstName = '',
    middleName = '',
    lastName = '',
    birthDate = '',
    phone = '',
    address = '',
    street = '',
    city = '',
    state = '',
    pin = '',
    gstin = '',
    pan = '',
    affiliateType = '',
    verificationDocument = '',
    verificationDocumentName = '',
    collegeName = '',
    universityName = '',
    socialMediaAccount = '',
    resumeDocument = '',
    resumeDocumentName = '',
    joinReason = '',
  }) {
    const email = profile.emails?.[0]?.value?.toLowerCase();
    const googleId = profile.id;
    const resolvedFirstName = String(firstName || '').trim() || profile.name?.givenName || '';
    const resolvedMiddleName = String(middleName || '').trim();
    const resolvedLastName = String(lastName || '').trim() || profile.name?.familyName || '';
    const resolvedBirthDate = parseBirthDate(birthDate);
    const resolvedPhone = String(phone || '').trim();
    const resolvedTenantName = String(tenantName || '').trim();

    if (allowCreate) {
      assertRequiredIdentity(
        {
          firstName: resolvedFirstName,
          middleName: resolvedMiddleName,
          lastName: resolvedLastName,
          birthDate,
          phone: resolvedPhone,
        },
        { requireBirthDate: roleSlug === ROLES.USER }
      );
    }

    const { normalizeBillingProfile } = require('@helpers/billingProfile.helper');
    const {
      isValidAffiliateType,
      getRequiredVerificationKind,
      getVerificationDocLabel,
      isValidVerificationDocument,
      buildAffiliateExtraFields,
    } = require('@constants/affiliateTypes');
    const billingProfile =
      roleSlug === ROLES.ADMIN
        ? normalizeBillingProfile({
            phone: resolvedPhone,
            address,
            street,
            city,
            state,
            pin,
            gstin,
            pan,
          })
        : null;
    const resolvedAffiliateType =
      roleSlug === ROLES.AFFILIATE && isValidAffiliateType(String(affiliateType || '').trim())
        ? String(affiliateType).trim()
        : null;

    let affiliateVerification = null;
    if (allowCreate && roleSlug === ROLES.AFFILIATE) {
      if (!resolvedAffiliateType) {
        throw new AppError('Affiliate type is required', HTTP_STATUS.BAD_REQUEST);
      }
      const AffiliateSettingsService = require('@services/affiliateSettings.service');
      await AffiliateSettingsService.assertTypeEnabled(resolvedAffiliateType);
      const kind = getRequiredVerificationKind(resolvedAffiliateType);
      const label = getVerificationDocLabel(kind);
      const document = String(verificationDocument || '').trim();
      if (!isValidVerificationDocument(document)) {
        throw new AppError(
          `${label} is required (JPG, PNG, WEBP, or PDF, max 5MB)`,
          HTTP_STATUS.BAD_REQUEST
        );
      }
      const extras = buildAffiliateExtraFields(resolvedAffiliateType, {
        collegeName,
        universityName,
        socialMediaAccount,
        resumeDocument,
        resumeDocumentName,
        joinReason,
      });
      if (!extras.ok) {
        throw new AppError(extras.error, HTTP_STATUS.BAD_REQUEST);
      }
      affiliateVerification = {
        affiliateType: resolvedAffiliateType,
        verificationDocumentKind: kind,
        verificationDocument: document,
        verificationDocumentName: String(verificationDocumentName || '').trim().slice(0, 200),
        verificationStatus: 'pending',
        affiliateApprovalStatus: AFFILIATE_APPROVAL_STATUS.PENDING_REVIEW,
        ...extras.data,
      };
    }

    if (!email || !googleId) {
      throw new AppError('Google profile is incomplete', HTTP_STATUS.BAD_REQUEST);
    }

    if (![ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.AFFILIATE, ROLES.USER].includes(roleSlug)) {
      throw new AppError('Invalid role for Google authentication', HTTP_STATUS.BAD_REQUEST);
    }

    if (allowCreate && roleSlug === ROLES.ADMIN && resolvedTenantName.length < 2) {
      throw new AppError(
        'Organization name is required before signing up with Google',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (allowCreate && roleSlug === ROLES.ADMIN) {
      if (!billingProfile.phone) {
        throw new AppError('Phone number is required', HTTP_STATUS.BAD_REQUEST);
      }
      if (!billingProfile.street && !billingProfile.address) {
        throw new AppError('Street address is required', HTTP_STATUS.BAD_REQUEST);
      }
      if (!billingProfile.state) {
        throw new AppError('State is required', HTTP_STATUS.BAD_REQUEST);
      }
      if (!billingProfile.city) {
        throw new AppError('City is required', HTTP_STATUS.BAD_REQUEST);
      }
      if (!/^\d{6}$/.test(billingProfile.pin || '')) {
        throw new AppError('Valid 6-digit PIN code is required', HTTP_STATUS.BAD_REQUEST);
      }
    }

    let oauth = await OAuthRepository.findByProvider('google', googleId);
    let user;

    if (oauth) {
      const userId = oauth.user?._id || oauth.user;
      user = userId ? await UserRepository.findById(userId) : null;
      // Orphaned OAuth after user delete — remove and continue as new signup/link
      if (!user) {
        await OAuthRepository.deleteByProvider('google', googleId);
        oauth = null;
      } else if (allowCreate && roleSlug !== ROLES.USER) {
        throw new AppError(
          'Account already exists. Please sign in instead.',
          HTTP_STATUS.CONFLICT
        );
      }
    }

    if (!oauth) {
      user = (await UserRepository.findByGoogleId(googleId)) || (await UserRepository.findByEmail(email));

      if (user) {
        if (allowCreate && roleSlug !== ROLES.USER) {
          throw new AppError(
            'Account already exists. Please sign in instead.',
            HTTP_STATUS.CONFLICT
          );
        }

        try {
          await OAuthRepository.create({
            provider: 'google',
            providerId: googleId,
            user: user._id,
          });
        } catch (error) {
          // Unique index race — ignore if link already exists
          if (error?.code !== 11000) {
            throw new AppError(
              error.message || 'Unable to link Google account',
              HTTP_STATUS.BAD_REQUEST
            );
          }
        }

        if (!user.googleId || user.googleId !== googleId) {
          try {
            const activate =
              roleSlug !== ROLES.AFFILIATE && !affiliateVerification;
            user = await UserRepository.updateById(user._id, {
              googleId,
              avatar: profile.photos?.[0]?.value || user.avatar,
              isEmailVerified: true,
              ...(activate ? { isActive: true } : {}),
              ...(affiliateVerification || {}),
            });
          } catch (error) {
            if (error?.code === 11000) {
              throw new AppError(
                'This Google account is already linked to another user',
                HTTP_STATUS.CONFLICT
              );
            }
            throw error;
          }
        } else if (affiliateVerification) {
          user = await UserRepository.updateById(user._id, {
            isEmailVerified: true,
            isActive: false,
            ...affiliateVerification,
          });
          try {
            const NotificationService = require('@services/notification.service');
            const name = user.fullName || user.firstName || 'Affiliate';
            await NotificationService.notifySuperAdmins({
              type: 'affiliate_pending_review',
              title: 'New affiliate application',
              message: `${name} (${user.email}) is waiting for review`,
              link: '/super-admin/affiliates/pending',
              meta: { affiliateId: String(user._id) },
            });
          } catch {
            // Non-blocking
          }
        }
      } else if (!allowCreate) {
        throw new AppError(
          'No account found. Please register first.',
          HTTP_STATUS.NOT_FOUND
        );
      } else {
        const role = await RoleRepository.findBySlug(roleSlug);
        if (!role) {
          throw new AppError(
            'Role not found. Please run: npm run seed',
            HTTP_STATUS.BAD_REQUEST
          );
        }

        const isAffiliateSignup = roleSlug === ROLES.AFFILIATE;
        try {
          user = await UserRepository.create({
            firstName: resolvedFirstName,
            middleName: resolvedMiddleName,
            lastName: resolvedLastName,
            birthDate: resolvedBirthDate,
            email,
            googleId,
            avatar: profile.photos?.[0]?.value,
            role: role._id,
            isEmailVerified: true,
            isActive: isAffiliateSignup ? false : true,
            phone: billingProfile?.phone || resolvedPhone || '',
            ...(affiliateVerification || {}),
          });

          await OAuthRepository.create({
            provider: 'google',
            providerId: googleId,
            user: user._id,
          });

          if (isAffiliateSignup && affiliateVerification) {
            try {
              const NotificationService = require('@services/notification.service');
              const name = user.fullName || user.firstName || 'Affiliate';
              await NotificationService.notifySuperAdmins({
                type: 'affiliate_pending_review',
                title: 'New affiliate application',
                message: `${name} (${user.email}) is waiting for review`,
                link: '/super-admin/affiliates/pending',
                meta: { affiliateId: String(user._id) },
              });
            } catch {
              // Non-blocking
            }
          }
        } catch (error) {
          if (error?.code === 11000) {
            throw new AppError(
              'Account already exists. Please sign in instead.',
              HTTP_STATUS.CONFLICT
            );
          }
          throw error;
        }
      }
    } else if (affiliateVerification && user) {
      // Existing Google-linked affiliate completing/updating application details
      user = await UserRepository.updateById(user._id, {
        isEmailVerified: true,
        isActive: false,
        firstName: resolvedFirstName || user.firstName,
        middleName: resolvedMiddleName || user.middleName,
        lastName: resolvedLastName || user.lastName,
        ...(resolvedBirthDate ? { birthDate: resolvedBirthDate } : {}),
        ...(resolvedPhone ? { phone: resolvedPhone } : {}),
        ...affiliateVerification,
      });
    }

    if (!user) {
      throw new AppError('No account found. Please register first.', HTTP_STATUS.NOT_FOUND);
    }

    const roleSlugOfUser = user.role?.slug;
    if (!roleSlugOfUser) {
      throw new AppError('User role is missing. Please contact support.', HTTP_STATUS.BAD_REQUEST);
    }
    if (roleSlugOfUser !== roleSlug) {
      throw new AppError('Access denied for this portal', HTTP_STATUS.FORBIDDEN);
    }

    // Affiliates stay inactive until approved — handleGoogleAuth returns requiresApproval.
    // Other roles must be active to continue.
    if (!user.isActive && roleSlugOfUser !== ROLES.AFFILIATE) {
      throw new AppError('Account is inactive', HTTP_STATUS.FORBIDDEN);
    }

    if (roleSlug === ROLES.ADMIN) {
      user = await UserRepository.findById(user._id);
      try {
        if (billingProfile?.phone) {
          await UserRepository.updateById(user._id, { phone: billingProfile.phone });
          user = await UserRepository.findById(user._id);
        }
        await createTenantForAdmin(
          user,
          resolvedTenantName || `${user.firstName || 'Shop'}'s Organization`,
          TENANT_STATUS.ACTIVE,
          billingProfile,
          loyaltyStampMode,
          category,
          customCategory
        );
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(
          error.message || 'Unable to create shop organization',
          HTTP_STATUS.BAD_REQUEST
        );
      }
    }

    return UserRepository.findById(user._id);
  }

  async handleGoogleAuth(user) {
    if (!user) {
      throw new AppError('Google authentication failed', HTTP_STATUS.UNAUTHORIZED);
    }

    const roleSlug = user.role?.slug || user.role;

    // Affiliates wait for approval — do not auto-activate or issue tokens
    if (roleSlug === ROLES.AFFILIATE) {
      let status = user.affiliateApprovalStatus;
      if (!user.isEmailVerified) {
        await UserRepository.updateById(user._id, { isEmailVerified: true });
      }
      if (!status) {
        // Brand-new Google signup without status yet → pending
        // Legacy approved accounts already have isActive true and no pending fields
        if (!user.isActive && !user.interviewMeetLink) {
          await UserRepository.updateById(user._id, {
            affiliateApprovalStatus: AFFILIATE_APPROVAL_STATUS.PENDING_REVIEW,
            isActive: false,
          });
          user = await UserRepository.findById(user._id);
          status = user.affiliateApprovalStatus;
        }
      }

      if (!isAffiliateApproved(status)) {
        return {
          requiresApproval: true,
          message:
            status === AFFILIATE_APPROVAL_STATUS.REJECTED
              ? 'Your affiliate application was not approved.'
              : status === AFFILIATE_APPROVAL_STATUS.INTERVIEW_SCHEDULED
                ? 'Your interview is scheduled. Login will be available after the interview decision.'
                : status === AFFILIATE_APPROVAL_STATUS.ON_HOLD
                  ? 'Your affiliate application is on hold. Please wait for further updates.'
                  : 'Your affiliate application is pending review. We will contact you about the next steps. Login is available only after approval.',
          email: user.email,
          user,
        };
      }
    }

    // Block suspended shops before any auto-reactivation
    assertAccountAccess(user, { forLogin: true });

    if (roleSlug === ROLES.ADMIN && !adminUserHasPlan(user)) {
      await removeUnpaidAdminAccount(user);
      throw new AppError(
        'No account found. Please register and complete payment first.',
        HTTP_STATUS.NOT_FOUND
      );
    }

    if (!user.isEmailVerified || !user.isActive) {
      // Never auto-reactivate affiliates here — approval/suspend is explicit
      if (roleSlug === ROLES.AFFILIATE) {
        if (!user.isActive) {
          throw new AppError('Account is inactive', HTTP_STATUS.FORBIDDEN);
        }
      } else {
        await UserRepository.updateById(user._id, {
          isEmailVerified: true,
          isActive: true,
        });
        user = await UserRepository.findById(user._id);
        assertAccountAccess(user, { forLogin: true });
      }
    }

    return this.issueTokens(user);
  }

  async resolveGoogleProfile({ idToken, accessToken }) {
    if (idToken) {
      let ticket;
      try {
        ticket = await googleClient.verifyIdToken({
          idToken,
          audience: config.google.clientId,
        });
      } catch {
        throw new AppError('Invalid Google credential', HTTP_STATUS.UNAUTHORIZED);
      }

      const payload = ticket.getPayload();
      if (!payload?.email || !payload.sub) {
        throw new AppError('Google profile is incomplete', HTTP_STATUS.BAD_REQUEST);
      }

      if (payload.email_verified === false) {
        throw new AppError('Google email is not verified', HTTP_STATUS.UNAUTHORIZED);
      }

      return {
        id: payload.sub,
        emails: [{ value: payload.email }],
        name: {
          givenName: payload.given_name || payload.name?.split(' ')?.[0] || 'User',
          familyName: payload.family_name || '',
        },
        photos: payload.picture ? [{ value: payload.picture }] : [],
      };
    }

    if (accessToken) {
      let tokenInfo;
      let userInfo;

      try {
        const tokenInfoRes = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
        );
        tokenInfo = await tokenInfoRes.json();

        if (!tokenInfoRes.ok) {
          throw new AppError('Invalid Google access token', HTTP_STATUS.UNAUTHORIZED);
        }

        const audience = tokenInfo.aud || tokenInfo.azp;
        if (audience && audience !== config.google.clientId) {
          throw new AppError('Google token audience mismatch', HTTP_STATUS.UNAUTHORIZED);
        }

        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        userInfo = await userInfoRes.json();

        if (!userInfoRes.ok || !userInfo.email || !userInfo.sub) {
          throw new AppError('Unable to fetch Google profile', HTTP_STATUS.UNAUTHORIZED);
        }
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError('Unable to verify Google access token', HTTP_STATUS.UNAUTHORIZED);
      }

      if (userInfo.email_verified === false || userInfo.email_verified === 'false') {
        throw new AppError('Google email is not verified', HTTP_STATUS.UNAUTHORIZED);
      }

      return {
        id: userInfo.sub,
        emails: [{ value: userInfo.email }],
        name: {
          givenName: userInfo.given_name || userInfo.name?.split(' ')?.[0] || 'User',
          familyName: userInfo.family_name || '',
        },
        photos: userInfo.picture ? [{ value: userInfo.picture }] : [],
      };
    }

    throw new AppError('Google credential is required', HTTP_STATUS.BAD_REQUEST);
  }

  async getGoogleProfilePreview({ idToken, accessToken }) {
    if (!config.google.clientId) {
      throw new AppError('Google sign-in is not configured', HTTP_STATUS.SERVICE_UNAVAILABLE);
    }

    const profile = await this.resolveGoogleProfile({ idToken, accessToken });
    const email = profile.emails?.[0]?.value?.toLowerCase();
    const googleId = profile.id;

    if (!email || !googleId) {
      throw new AppError('Google profile is incomplete', HTTP_STATUS.BAD_REQUEST);
    }

    const existing =
      (await UserRepository.findByGoogleId(googleId)) || (await UserRepository.findByEmail(email));

    let accountExists = Boolean(existing);
    if (existing && (existing.role?.slug || existing.role) === ROLES.ADMIN) {
      accountExists = adminUserHasPlan(existing);
    }

    return {
      email,
      firstName: profile.name?.givenName || email.split('@')[0] || 'User',
      lastName: profile.name?.familyName || '',
      avatar: profile.photos?.[0]?.value || null,
      accountExists,
      role: existing?.role?.slug || null,
    };
  }

  async loginWithGoogle({
    idToken,
    accessToken,
    role,
    allowCreate = false,
    secretCode = '',
    tenantName = '',
    loyaltyStampMode = '',
    category = '',
    customCategory = '',
    firstName = '',
    middleName = '',
    lastName = '',
    birthDate = '',
    phone = '',
    address = '',
    street = '',
    city = '',
    state = '',
    pin = '',
    gstin = '',
    pan = '',
    affiliateType = '',
    verificationDocument = '',
    verificationDocumentName = '',
    collegeName = '',
    universityName = '',
    socialMediaAccount = '',
    resumeDocument = '',
    resumeDocumentName = '',
    joinReason = '',
    planCode = '',
    discountCode = '',
  }) {
    if (!config.google.clientId) {
      throw new AppError('Google sign-in is not configured', HTTP_STATUS.SERVICE_UNAVAILABLE);
    }

    assertSuperAdminSecretCode(secretCode, role);

    const profile = await this.resolveGoogleProfile({ idToken, accessToken });

    // New admin Google signup → pending draft + registration token (account after payment)
    if (Boolean(allowCreate) && role === ROLES.ADMIN) {
      const email = profile.emails?.[0]?.value?.toLowerCase();
      const googleId = profile.id;
      const existing =
        (await UserRepository.findByGoogleId(googleId)) ||
        (await UserRepository.findByEmail(email));
      if (existing) {
        if ((existing.role?.slug || existing.role) !== ROLES.ADMIN) {
          throw new AppError(
            'This Google account belongs to a different portal',
            HTTP_STATUS.CONFLICT
          );
        }
        if (adminUserHasPlan(existing)) {
          throw new AppError(
            'Account already exists. Please sign in instead.',
            HTTP_STATUS.CONFLICT
          );
        }
        await removeUnpaidAdminAccount(existing);
      }

      return this.saveAdminPendingRegistration({
        firstName: firstName || profile.name?.givenName || '',
        middleName,
        lastName: lastName || profile.name?.familyName || '',
        email,
        googleId,
        avatar: profile.photos?.[0]?.value || null,
        phone,
        tenantName,
        loyaltyStampMode,
        category,
        customCategory,
        billingProfile: {
          phone,
          address,
          street,
          city,
          state,
          pin,
          gstin,
          pan,
        },
        planCode,
        discountCode,
        emailVerified: true,
      });
    }

    const user = await this.findOrCreateGoogleUser({
      profile,
      roleSlug: role,
      allowCreate: Boolean(allowCreate),
      tenantName,
      loyaltyStampMode,
      category,
      customCategory,
      firstName,
      middleName,
      lastName,
      birthDate,
      phone,
      address,
      street,
      city,
      state,
      pin,
      gstin,
      pan,
      affiliateType,
      verificationDocument,
      verificationDocumentName,
      collegeName,
      universityName,
      socialMediaAccount,
      resumeDocument,
      resumeDocumentName,
      joinReason,
    });
    return this.handleGoogleAuth(user);
  }

  async forgotPassword({ email, expectedRole }) {
    const user = await UserRepository.findByEmail(email);

    // Avoid account enumeration when possible, but still validate role when found.
    if (!user) {
      return {
        message: 'If an account exists for this email, a reset code has been sent.',
        email,
        expiresInMinutes: config.otp.expiresMinutes,
        preview: !config.smtp.host || !config.smtp.user,
      };
    }

    if (expectedRole && user.role.slug !== expectedRole) {
      throw new AppError('Access denied for this portal', HTTP_STATUS.FORBIDDEN);
    }

    if (user.role.slug === ROLES.USER) {
      throw new AppError('User role authentication is not available', HTTP_STATUS.FORBIDDEN);
    }

    const otpMeta = await this.createAndSendOtp(email, 'password_reset');

    return {
      message: 'If an account exists for this email, a reset code has been sent.',
      ...otpMeta,
    };
  }

  async resetPassword({ email, code, password, expectedRole }) {
    const otp = await EmailOtpRepository.findValid(email, 'password_reset');

    if (!otp) {
      throw new AppError('Invalid or expired verification code', HTTP_STATUS.BAD_REQUEST);
    }

    if (otp.attempts >= config.otp.maxAttempts) {
      await EmailOtpRepository.deleteByEmail(email, 'password_reset');
      throw new AppError('Too many invalid attempts. Request a new code.', HTTP_STATUS.BAD_REQUEST);
    }

    if (otp.code !== String(code).trim()) {
      await EmailOtpRepository.incrementAttempts(otp._id);
      throw new AppError('Invalid verification code', HTTP_STATUS.BAD_REQUEST);
    }

    const user = await UserRepository.findByEmailWithPassword(email);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    if (expectedRole && user.role.slug !== expectedRole) {
      throw new AppError('Access denied for this portal', HTTP_STATUS.FORBIDDEN);
    }

    await UserRepository.updateCredentials(user._id, { password });

    // Keep SA Affiliate List → View in sync with the password the affiliate actually uses
    const roleSlug = user.role?.slug || user.role || expectedRole;
    if (roleSlug === ROLES.AFFILIATE || expectedRole === ROLES.AFFILIATE) {
      await UserRepository.setAffiliateIssuedPassword(user._id, String(password).trim());
    }

    await EmailOtpRepository.deleteByEmail(email, 'password_reset');

    // Ensure email is treated as verified after a successful reset via email OTP.
    if (!user.isEmailVerified) {
      const isAffiliate = user.role?.slug === ROLES.AFFILIATE;
      await UserRepository.updateById(user._id, {
        isEmailVerified: true,
        ...(isAffiliate
          ? {
              isActive: false,
              affiliateApprovalStatus:
                user.affiliateApprovalStatus || AFFILIATE_APPROVAL_STATUS.PENDING_REVIEW,
            }
          : { isActive: true }),
      });
    }

    return {
      message: 'Password updated successfully. You can sign in with your new password.',
      email,
    };
  }
}

module.exports = new AuthService();
