'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { ArrowRight, Mail, ShieldCheck } from 'lucide-react';
import { getRegisterSchema, getGoogleCompleteSchema } from '@/lib/validations/auth';
import { authService } from '@/services/auth.service';
import { agreementSettingsService } from '@/services/agreementSettings.service';
import { affiliateSettingsService } from '@/services/affiliateSettings.service';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABELS, ROLES, SHOP_CATEGORIES, SHOP_CATEGORY_OPTIONS } from '@/constants';
import {
  AFFILIATE_TYPES,
  AFFILIATE_TYPE_OPTIONS,
  getRequiredVerificationKind,
  getVerificationDocLabel,
} from '@/constants/affiliateTypes';
import { getErrorMessage, getLoginPath } from '@/utils';
import { useClientMounted } from '@/hooks/useClientMounted';
import { GoogleSignInButton } from '@/components/buttons/GoogleSignInButton';
import { PasswordField } from '@/components/forms/PasswordField';
import { AuthInput, AuthSelect, AuthButton } from '@/components/forms/AuthNativeFields';
import { VerificationDocumentField } from '@/components/forms/VerificationDocumentField';
import { LoyaltyStampModeSelector } from '@/features/admin/LoyaltyStampModeSelector';
import {
  TermsAcceptanceBlock,
  isTermsAcceptanceRequired,
} from '@/components/forms/TermsAcceptanceBlock';
import {
  BillingAddressFields,
  composeBillingAddress,
} from '@/components/forms/BillingAddressFields';

const REGISTER_COPY = {
  [ROLES.ADMIN]: {
    title: 'Create Account',
    subtitle: 'Register to continue with your selected plan. Email signup needs a one-time code.',
  },
  [ROLES.SUPER_ADMIN]: {
    title: 'Create Super Admin',
    subtitle: 'Register the platform owner account and verify with a one-time email code.',
  },
  [ROLES.AFFILIATE]: {
    title: 'Join as Affiliate Partner',
    subtitle: 'Create your affiliate account and verify with a one-time email code.',
  },
};

const inputClass =
  'h-[52px] w-full rounded-[10px] border border-[#D0D5DD] bg-white px-4 text-[17px] text-[#101828] outline-none transition placeholder:text-[#98A2B3] focus:border-[#021A54] focus:ring-1 focus:ring-[#021A54]';
const billingDefaults = {
  phone: '',
  street: '',
  state: '',
  stateCode: '',
  city: '',
  pin: '',
  gstin: '',
  pan: '',
};

function BillingFields({ register, errors, idPrefix = '', addressValues, onAddressChange }) {
  return (
    <>
      <div>
        <label
          htmlFor={`${idPrefix}phone`}
          className="mb-1.5 block text-[16px] font-semibold text-[#101828]"
        >
          Phone number <span className="text-red-500">*</span>
        </label>
        <AuthInput
          id={`${idPrefix}phone`}
          type="tel"
          autoComplete="tel"
          placeholder="+91 98765 43210"
          suppressHydrationWarning
          className={`${inputClass} ${errors.phone ? 'border-red-500' : ''}`}
          {...register('phone')}
        />
        {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>}
      </div>

      <BillingAddressFields
        idPrefix={idPrefix}
        values={addressValues}
        errors={errors}
        onChange={onAddressChange}
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${idPrefix}gstin`}
            className="mb-1.5 block text-[16px] font-semibold text-[#101828]"
          >
            GSTIN <span className="font-normal text-[#98A2B3]">(optional)</span>
          </label>
          <AuthInput
            id={`${idPrefix}gstin`}
            placeholder="22AAAAA0000A1Z5"
            className={`${inputClass} ${errors.gstin ? 'border-red-500' : ''}`}
            {...register('gstin')}
          />
          {errors.gstin && <p className="mt-1 text-xs text-red-500">{errors.gstin.message}</p>}
        </div>
        <div>
          <label
            htmlFor={`${idPrefix}pan`}
            className="mb-1.5 block text-[16px] font-semibold text-[#101828]"
          >
            PAN <span className="font-normal text-[#98A2B3]">(optional)</span>
          </label>
          <AuthInput
            id={`${idPrefix}pan`}
            placeholder="ABCDE1234F"
            className={`${inputClass} ${errors.pan ? 'border-red-500' : ''}`}
            {...register('pan')}
          />
          {errors.pan && <p className="mt-1 text-xs text-red-500">{errors.pan.message}</p>}
        </div>
      </div>
    </>
  );
}

function buildBillingPayload(values) {
  const street = String(values.street || '').trim();
  const city = String(values.city || '').trim();
  const state = String(values.state || '').trim();
  const pin = String(values.pin || '').trim();
  return {
    phone: String(values.phone || '').trim(),
    street,
    city,
    state,
    pin,
    address: composeBillingAddress({ street, city, state, pin }),
    gstin: String(values.gstin || '').trim().toUpperCase(),
    pan: String(values.pan || '').trim().toUpperCase(),
  };
}

export function PortalRegisterForm(props) {
  return (
    <Suspense fallback={null}>
      <PortalRegisterFormInner {...props} />
    </Suspense>
  );
}

function PortalRegisterFormInner({ role }) {
  const mounted = useClientMounted();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuth();
  const planCode = searchParams.get('plan') || '';
  const schema = getRegisterSchema(role);
  const copy = REGISTER_COPY[role] || REGISTER_COPY[ROLES.ADMIN];
  const showTenant = role === ROLES.ADMIN;
  const showAffiliateType = role === ROLES.AFFILIATE;
  const termsAudience = role === ROLES.ADMIN ? 'client' : role === ROLES.AFFILIATE ? 'affiliate' : null;

  const [googleDraft, setGoogleDraft] = useState(null);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [terms, setTerms] = useState(null);
  const [termsLoading, setTermsLoading] = useState(Boolean(termsAudience));
  const [termsLoadFailed, setTermsLoadFailed] = useState(false);
  const [affiliateTypeOptions, setAffiliateTypeOptions] = useState(AFFILIATE_TYPE_OPTIONS);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      middleName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      tenantName: '',
      loyaltyStampMode: 'bill',
      category: '',
      customCategory: '',
      affiliateType: '',
      verificationDocument: '',
      verificationDocumentName: '',
      collegeName: '',
      universityName: '',
      socialMediaAccount: '',
      joinReason: '',
      resumeDocument: '',
      resumeDocumentName: '',
      acceptTerms: false,
      ...billingDefaults,
    },
  });

  const googleForm = useForm({
    resolver: zodResolver(getGoogleCompleteSchema(role)),
    defaultValues: {
      firstName: '',
      middleName: '',
      lastName: '',
      email: '',
      tenantName: '',
      loyaltyStampMode: 'bill',
      category: '',
      customCategory: '',
      affiliateType: '',
      verificationDocument: '',
      verificationDocumentName: '',
      collegeName: '',
      universityName: '',
      socialMediaAccount: '',
      joinReason: '',
      resumeDocument: '',
      resumeDocumentName: '',
      acceptTerms: false,
      ...billingDefaults,
    },
  });

  useEffect(() => {
    if (!termsAudience) {
      setTerms(null);
      setTermsLoading(false);
      return undefined;
    }

    let cancelled = false;
    setTermsLoading(true);
    setTermsLoadFailed(false);
    agreementSettingsService
      .getPublic(termsAudience)
      .then(({ data }) => {
        if (!cancelled) {
          setTerms(data.data.settings || null);
          setTermsLoadFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTerms(null);
          setTermsLoadFailed(true);
          toast.error('Unable to load terms and conditions');
        }
      })
      .finally(() => {
        if (!cancelled) setTermsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [termsAudience]);

  useEffect(() => {
    if (!showAffiliateType) {
      setAffiliateTypeOptions(AFFILIATE_TYPE_OPTIONS);
      return undefined;
    }

    let cancelled = false;
    affiliateSettingsService
      .getPublic()
      .then(({ data }) => {
        if (cancelled) return;
        const enabled = data?.data?.settings?.enabledTypes;
        if (Array.isArray(enabled) && enabled.length > 0) {
          setAffiliateTypeOptions(
            enabled.map((row) => ({
              value: row.value,
              label: row.label || row.value,
            }))
          );
        } else {
          setAffiliateTypeOptions([]);
        }
      })
      .catch(() => {
        if (!cancelled) setAffiliateTypeOptions(AFFILIATE_TYPE_OPTIONS);
      });

    return () => {
      cancelled = true;
    };
  }, [showAffiliateType]);

  const termsRequired = isTermsAcceptanceRequired(terms);
  const termsBlockSubmit = Boolean(termsAudience && (termsLoading || termsLoadFailed));
  const addressValues = {
    street: watch('street') || '',
    state: watch('state') || '',
    stateCode: watch('stateCode') || '',
    city: watch('city') || '',
    pin: watch('pin') || '',
  };

  const googleAddressValues = {
    street: googleForm.watch('street') || '',
    state: googleForm.watch('state') || '',
    stateCode: googleForm.watch('stateCode') || '',
    city: googleForm.watch('city') || '',
    pin: googleForm.watch('pin') || '',
  };

  const affiliateType = watch('affiliateType') || '';
  const verificationKind = showAffiliateType
    ? getRequiredVerificationKind(affiliateType)
    : null;
  const verificationLabel = verificationKind
    ? getVerificationDocLabel(verificationKind)
    : '';

  const googleAffiliateType = googleForm.watch('affiliateType') || '';
  const googleVerificationKind = showAffiliateType
    ? getRequiredVerificationKind(googleAffiliateType)
    : null;
  const googleVerificationLabel = googleVerificationKind
    ? getVerificationDocLabel(googleVerificationKind)
    : '';

  const clearAffiliateExtras = useCallback((setValueFn) => {
    setValueFn('verificationDocument', '');
    setValueFn('verificationDocumentName', '');
    setValueFn('collegeName', '');
    setValueFn('universityName', '');
    setValueFn('socialMediaAccount', '');
    setValueFn('resumeDocument', '');
    setValueFn('resumeDocumentName', '');
  }, []);

  const applyAddressValues = useCallback(
    (setValueFn) => (next) => {
      setValueFn('street', next.street || '', { shouldValidate: true, shouldDirty: true });
      setValueFn('state', next.state || '', { shouldValidate: true, shouldDirty: true });
      setValueFn('stateCode', next.stateCode || '', { shouldValidate: true, shouldDirty: true });
      setValueFn('city', next.city || '', { shouldValidate: true, shouldDirty: true });
      setValueFn('pin', next.pin || '', { shouldValidate: true, shouldDirty: true });
    },
    []
  );

  const finishAdminRedirect = useCallback(() => {
    if (role !== ROLES.ADMIN) {
      router.push(`/${role}/dashboard`);
      return;
    }
    if (planCode) {
      // Hard nav avoids auth-shell racing checkout
      window.location.assign(`/checkout?plan=${encodeURIComponent(planCode)}`);
      return;
    }
    // Soft nav keeps SPA cache — pricing feels instant
    router.push('/pricing');
  }, [planCode, role, router]);

  const handleGoogleAccessToken = useCallback(
    async (accessToken) => {
      try {
        const { data } = await authService.googleProfile({ accessToken });
        const profile = data.data.profile;

        if (profile.accountExists) {
          if (profile.role && profile.role !== role) {
            toast.error('This Google account belongs to a different portal');
            return;
          }

          toast.error('Account already exists. Please sign in instead.');
          const loginPath = getLoginPath(role);
          if (role === ROLES.ADMIN && planCode) {
            router.push(
              `${loginPath}?redirect=${encodeURIComponent(`/checkout?plan=${encodeURIComponent(planCode)}`)}`
            );
          } else {
            router.push(loginPath);
          }
          return;
        }

        setGoogleDraft({ accessToken, profile });
        googleForm.reset({
          firstName: profile.firstName || '',
          middleName: '',
          lastName: profile.lastName || '',
          email: profile.email || '',
          tenantName: '',
          loyaltyStampMode: 'bill',
          category: '',
          customCategory: '',
          affiliateType: '',
          verificationDocument: '',
          verificationDocumentName: '',
          collegeName: '',
          universityName: '',
          socialMediaAccount: '',
          joinReason: '',
          resumeDocument: '',
          resumeDocumentName: '',
          acceptTerms: false,
          ...billingDefaults,
        });
        toast.success('Google details loaded — review and continue');
      } catch (error) {
        toast.error(getErrorMessage(error, 'Unable to load Google profile'));
      }
    },
    [googleForm, planCode, role, router, setUser]
  );

  const onGoogleComplete = async (values) => {
    if (!googleDraft?.accessToken) {
      toast.error('Google session expired. Please continue with Google again.');
      setGoogleDraft(null);
      return;
    }

    if (termsRequired && !values.acceptTerms) {
      googleForm.setError('acceptTerms', {
        type: 'manual',
        message: 'You must accept the Terms and Conditions to continue',
      });
      toast.error('Please accept the Terms and Conditions');
      return;
    }

    try {
      setGoogleSubmitting(true);
      const payload = {
        accessToken: googleDraft.accessToken,
        allowCreate: true,
        firstName: values.firstName.trim(),
        middleName: values.middleName.trim(),
        lastName: values.lastName.trim(),
        phone: String(values.phone || '').trim(),
        acceptTerms: Boolean(values.acceptTerms),
      };
      if (showTenant) {
        payload.tenantName = values.tenantName.trim();
        payload.loyaltyStampMode = values.loyaltyStampMode || 'bill';
        payload.category = values.category;
        payload.customCategory =
          values.category === SHOP_CATEGORIES.CUSTOM
            ? String(values.customCategory || '').trim()
            : '';
        Object.assign(payload, buildBillingPayload(values));
      }
      if (showAffiliateType) {
        payload.affiliateType = values.affiliateType;
        payload.verificationDocument = values.verificationDocument;
        payload.verificationDocumentName = values.verificationDocumentName || '';
        payload.joinReason = values.joinReason;
        if (values.affiliateType === AFFILIATE_TYPES.STUDENT) {
          payload.collegeName = values.collegeName;
          payload.universityName = values.universityName || '';
        }
        if (values.affiliateType === AFFILIATE_TYPES.SOCIAL_MEDIA_CREATOR) {
          payload.socialMediaAccount = values.socialMediaAccount;
        }
        if (values.affiliateType === AFFILIATE_TYPES.FREELANCER_DIGITAL_MARKETER) {
          payload.resumeDocument = values.resumeDocument;
          payload.resumeDocumentName = values.resumeDocumentName || '';
        }
      }

      const { data } = await authService.googleLogin(role, payload);
      if (data.data?.requiresApproval) {
        toast.success(
          data.message ||
            'Application submitted. We will review it and contact you about the interview. Login is available only after approval.'
        );
        setGoogleDraft(null);
        router.push(`/${role}/login`);
        return;
      }
      setUser(data.data.user);
      toast.success('Account created with Google');
      finishAdminRedirect();
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to create account with Google');
      toast.error(message);
      if (
        error?.response?.status === 409 ||
        /already exists|sign in/i.test(message)
      ) {
        setGoogleDraft(null);
        const loginPath = getLoginPath(role);
        if (role === ROLES.ADMIN && planCode) {
          router.push(
            `${loginPath}?redirect=${encodeURIComponent(`/checkout?plan=${encodeURIComponent(planCode)}`)}`
          );
        } else {
          router.push(loginPath);
        }
      }
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const onSubmit = async (values) => {
    if (termsRequired && !values.acceptTerms) {
      setError('acceptTerms', {
        type: 'manual',
        message: 'You must accept the Terms and Conditions to continue',
      });
      toast.error('Please accept the Terms and Conditions');
      return;
    }

    try {
      const payload = {
        firstName: values.firstName,
        middleName: values.middleName,
        lastName: values.lastName,
        phone: String(values.phone || '').trim(),
        email: values.email,
        acceptTerms: Boolean(values.acceptTerms),
      };
      if (!showAffiliateType) {
        payload.password = values.password;
      }

      if (showTenant) {
        payload.tenantName = values.tenantName;
        payload.loyaltyStampMode = values.loyaltyStampMode || 'bill';
        payload.category = values.category;
        payload.customCategory =
          values.category === SHOP_CATEGORIES.CUSTOM
            ? String(values.customCategory || '').trim()
            : '';
        Object.assign(payload, buildBillingPayload(values));
      }
      if (showAffiliateType) {
        payload.affiliateType = values.affiliateType;
        payload.verificationDocument = values.verificationDocument;
        payload.verificationDocumentName = values.verificationDocumentName || '';
        payload.joinReason = values.joinReason;
        if (values.affiliateType === AFFILIATE_TYPES.STUDENT) {
          payload.collegeName = values.collegeName;
          payload.universityName = values.universityName || '';
        }
        if (values.affiliateType === AFFILIATE_TYPES.SOCIAL_MEDIA_CREATOR) {
          payload.socialMediaAccount = values.socialMediaAccount;
        }
        if (values.affiliateType === AFFILIATE_TYPES.FREELANCER_DIGITAL_MARKETER) {
          payload.resumeDocument = values.resumeDocument;
          payload.resumeDocumentName = values.resumeDocumentName || '';
        }
      }

      const { data } = await authService.register(role, payload);

      if (data.data?.requiresVerification) {
        toast.success('OTP sent to your email');
        const params = new URLSearchParams({ email: values.email });
        if (planCode) params.set('plan', planCode);
        router.push(`/${role}/verify-email?${params.toString()}`);
        return;
      }

      toast.success('Registration successful');
      finishAdminRedirect();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Registration failed'));
    }
  };

  if (!mounted) {
    return (
      <div className="w-full" aria-busy="true">
        <div className="mb-5 text-center">
          <h1 className="text-[30px] font-bold leading-tight tracking-[-0.02em] text-[#021A54]">
            {copy.title}
          </h1>
          <p className="mt-2.5 text-[17px] leading-snug text-[#667085]">{copy.subtitle}</p>
        </div>
        <div className="h-[52px] w-full animate-pulse rounded-[10px] bg-[#F2F4F7]" />
        <div className="mt-4 space-y-3">
          <div className="h-[52px] w-full animate-pulse rounded-[10px] bg-[#F2F4F7]" />
          <div className="h-[52px] w-full animate-pulse rounded-[10px] bg-[#F2F4F7]" />
          <div className="h-[52px] w-full animate-pulse rounded-[10px] bg-[#F2F4F7]" />
        </div>
      </div>
    );
  }

  if (googleDraft) {
    const gErrors = googleForm.formState.errors;

    return (
      <div className="w-full">
        <div className="mb-3 text-center">
          <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-[#021A54] sm:text-[30px]">
            Confirm your details
          </h1>
          <p className="mt-2 text-[15px] leading-snug text-[#667085] sm:text-[17px]">
            We filled this from Google. Edit anything you want, then continue.
          </p>
        </div>

        <form
          onSubmit={googleForm.handleSubmit(onGoogleComplete)}
          className="space-y-2.5"
          noValidate
        >
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div>
              <label
                htmlFor="googleFirstName"
                className="mb-1.5 block text-[16px] font-semibold text-[#101828]"
              >
                First name
              </label>
              <AuthInput
                id="googleFirstName"
                className={`${inputClass} ${gErrors.firstName ? 'border-red-500' : ''}`}
                {...googleForm.register('firstName')}
              />
              {gErrors.firstName && (
                <p className="mt-1 text-xs text-red-500">{gErrors.firstName.message}</p>
              )}
            </div>
            <div>
              <label
                htmlFor="googleMiddleName"
                className="mb-1.5 block text-[16px] font-semibold text-[#101828]"
              >
                Middle name
              </label>
              <AuthInput
                id="googleMiddleName"
                className={`${inputClass} ${gErrors.middleName ? 'border-red-500' : ''}`}
                {...googleForm.register('middleName')}
              />
              {gErrors.middleName && (
                <p className="mt-1 text-xs text-red-500">{gErrors.middleName.message}</p>
              )}
            </div>
            <div>
              <label
                htmlFor="googleLastName"
                className="mb-1.5 block text-[16px] font-semibold text-[#101828]"
              >
                Last name
              </label>
              <AuthInput
                id="googleLastName"
                className={`${inputClass} ${gErrors.lastName ? 'border-red-500' : ''}`}
                {...googleForm.register('lastName')}
              />
              {gErrors.lastName && (
                <p className="mt-1 text-xs text-red-500">{gErrors.lastName.message}</p>
              )}
            </div>
          </div>

          {!showTenant ? (
            <div>
              <label
                htmlFor="googlePhone"
                className="mb-1.5 block text-[16px] font-semibold text-[#101828]"
              >
                Mobile number
              </label>
              <AuthInput
                id="googlePhone"
                type="tel"
                autoComplete="tel"
                placeholder="+91 98765 43210"
                className={`${inputClass} ${gErrors.phone ? 'border-red-500' : ''}`}
                {...googleForm.register('phone')}
              />
              {gErrors.phone && (
                <p className="mt-1 text-xs text-red-500">{gErrors.phone.message}</p>
              )}
            </div>
          ) : null}

          <div className={`grid grid-cols-1 gap-2 ${showAffiliateType ? 'sm:grid-cols-2' : ''}`}>
            <div>
              <label
                htmlFor="googleEmail"
                className="mb-1.5 block text-[16px] font-semibold text-[#101828]"
              >
                Email
              </label>
              <AuthInput
                id="googleEmail"
                type="email"
                readOnly
                className={`${inputClass} bg-[#F9FAFB] text-[#667085]`}
                {...googleForm.register('email')}
              />
            </div>

            {showAffiliateType ? (
              <div>
                <label
                  htmlFor="googleAffiliateType"
                  className="mb-1.5 block text-[16px] font-semibold text-[#101828]"
                >
                  Affiliate type <span className="text-red-500">*</span>
                </label>
                <AuthSelect
                  id="googleAffiliateType"
                  className={`${inputClass} ${gErrors.affiliateType ? 'border-red-500' : ''} ${
                    !googleForm.watch('affiliateType') ? 'text-[#98A2B3]' : ''
                  }`}
                  {...googleForm.register('affiliateType', {
                    onChange: () => clearAffiliateExtras(googleForm.setValue),
                  })}
                >
                  <option value="">Select type</option>
                  {affiliateTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </AuthSelect>
                {gErrors.affiliateType ? (
                  <p className="mt-1 text-xs text-red-500">{gErrors.affiliateType.message}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          {showAffiliateType ? (
            <>
              {googleAffiliateType === AFFILIATE_TYPES.STUDENT ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="googleCollegeName"
                      className="mb-1.5 block text-[16px] font-semibold text-[#101828]"
                    >
                      College <span className="text-red-500">*</span>
                    </label>
                    <AuthInput
                      id="googleCollegeName"
                      placeholder="Enter college"
                      className={`${inputClass} ${gErrors.collegeName ? 'border-red-500' : ''}`}
                      {...googleForm.register('collegeName')}
                    />
                    {gErrors.collegeName ? (
                      <p className="mt-1 text-xs text-red-500">{gErrors.collegeName.message}</p>
                    ) : null}
                  </div>
                  <div>
                    <label
                      htmlFor="googleUniversityName"
                      className="mb-1.5 block text-[16px] font-semibold text-[#101828]"
                    >
                      University <span className="font-normal text-[#98A2B3]">(optional)</span>
                    </label>
                    <AuthInput
                      id="googleUniversityName"
                      placeholder="Enter university"
                      className={`${inputClass} ${gErrors.universityName ? 'border-red-500' : ''}`}
                      {...googleForm.register('universityName')}
                    />
                    {gErrors.universityName ? (
                      <p className="mt-1 text-xs text-red-500">{gErrors.universityName.message}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {googleAffiliateType === AFFILIATE_TYPES.SOCIAL_MEDIA_CREATOR ? (
                <div>
                  <label
                    htmlFor="googleSocialMediaAccount"
                    className="mb-1.5 block text-[16px] font-semibold text-[#101828]"
                  >
                    Social media account <span className="text-red-500">*</span>
                  </label>
                  <AuthInput
                    id="googleSocialMediaAccount"
                    placeholder="Instagram / YouTube / LinkedIn URL or handle"
                    className={`${inputClass} ${gErrors.socialMediaAccount ? 'border-red-500' : ''}`}
                    {...googleForm.register('socialMediaAccount')}
                  />
                  {gErrors.socialMediaAccount ? (
                    <p className="mt-1 text-xs text-red-500">
                      {gErrors.socialMediaAccount.message}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {googleAffiliateType === AFFILIATE_TYPES.FREELANCER_DIGITAL_MARKETER ||
              googleVerificationKind ? (
                <div
                  className={`grid grid-cols-1 gap-2 ${
                    googleAffiliateType === AFFILIATE_TYPES.FREELANCER_DIGITAL_MARKETER &&
                    googleVerificationKind
                      ? 'sm:grid-cols-2'
                      : ''
                  }`}
                >
                  {googleAffiliateType === AFFILIATE_TYPES.FREELANCER_DIGITAL_MARKETER ? (
                    <VerificationDocumentField
                      label="Resume"
                      required
                      value={googleForm.watch('resumeDocument') || ''}
                      fileName={googleForm.watch('resumeDocumentName') || ''}
                      error={gErrors.resumeDocument?.message || ''}
                      onChange={(next) => {
                        googleForm.setValue('resumeDocument', next.verificationDocument, {
                          shouldValidate: true,
                          shouldDirty: true,
                        });
                        googleForm.setValue(
                          'resumeDocumentName',
                          next.verificationDocumentName || '',
                          { shouldDirty: true }
                        );
                      }}
                    />
                  ) : null}

                  {googleVerificationKind ? (
                    <VerificationDocumentField
                      label={googleVerificationLabel}
                      required
                      value={googleForm.watch('verificationDocument') || ''}
                      fileName={googleForm.watch('verificationDocumentName') || ''}
                      error={gErrors.verificationDocument?.message || ''}
                      onChange={(next) => {
                        googleForm.setValue('verificationDocument', next.verificationDocument, {
                          shouldValidate: true,
                          shouldDirty: true,
                        });
                        googleForm.setValue(
                          'verificationDocumentName',
                          next.verificationDocumentName || '',
                          { shouldDirty: true }
                        );
                      }}
                    />
                  ) : null}
                </div>
              ) : null}

              <div>
                <label
                  htmlFor="googleJoinReason"
                  className="mb-1.5 block text-[16px] font-semibold text-[#101828]"
                >
                  Why do you join with us? <span className="text-red-500">*</span>
                </label>
                <AuthInput
                  id="googleJoinReason"
                  type="text"
                  placeholder="Give a valid answer"
                  className={`${inputClass} ${gErrors.joinReason ? 'border-red-500' : ''}`}
                  {...googleForm.register('joinReason')}
                />
                {gErrors.joinReason ? (
                  <p className="mt-1 text-xs text-red-500">{gErrors.joinReason.message}</p>
                ) : null}
              </div>
            </>
          ) : null}

          {showTenant && (
            <>
              <div>
                <label
                  htmlFor="googleTenantName"
                  className="mb-1.5 block text-[16px] font-semibold text-[#101828]"
                >
                  Organization name
                </label>
                <AuthInput
                  id="googleTenantName"
                  placeholder="Acme Inc."
                  className={`${inputClass} ${gErrors.tenantName ? 'border-red-500' : ''}`}
                  {...googleForm.register('tenantName')}
                />
                {gErrors.tenantName && (
                  <p className="mt-1 text-xs text-red-500">{gErrors.tenantName.message}</p>
                )}
              </div>
              <div>
                <label
                  htmlFor="googleCategory"
                  className="mb-1.5 block text-[16px] font-semibold text-[#101828]"
                >
                  Category <span className="text-red-500">*</span>
                </label>
                <AuthSelect
                  id="googleCategory"
                  className={`${inputClass} ${gErrors.category ? 'border-red-500' : ''} ${
                    !googleForm.watch('category') ? 'text-[#98A2B3]' : ''
                  }`}
                  {...googleForm.register('category')}
                >
                  <option value="">Select category</option>
                  {SHOP_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </AuthSelect>
                {gErrors.category && (
                  <p className="mt-1 text-xs text-red-500">{gErrors.category.message}</p>
                )}
              </div>
              {googleForm.watch('category') === SHOP_CATEGORIES.CUSTOM ? (
                <div>
                  <label
                    htmlFor="googleCustomCategory"
                    className="mb-1.5 block text-[16px] font-semibold text-[#101828]"
                  >
                    Custom category <span className="text-red-500">*</span>
                  </label>
                  <AuthInput
                    id="googleCustomCategory"
                    placeholder="e.g. Pet store"
                    className={`${inputClass} ${gErrors.customCategory ? 'border-red-500' : ''}`}
                    {...googleForm.register('customCategory')}
                  />
                  {gErrors.customCategory && (
                    <p className="mt-1 text-xs text-red-500">{gErrors.customCategory.message}</p>
                  )}
                </div>
              ) : null}
              <BillingFields
                register={googleForm.register}
                errors={gErrors}
                idPrefix="google"
                addressValues={googleAddressValues}
                onAddressChange={applyAddressValues(googleForm.setValue)}
              />
              <LoyaltyStampModeSelector
                value={googleForm.watch('loyaltyStampMode') || 'bill'}
                onChange={(v) =>
                  googleForm.setValue('loyaltyStampMode', v, { shouldValidate: true, shouldDirty: true })
                }
              />
            </>
          )}

          {termsAudience ? (
            <>
              {termsLoadFailed ? (
                <p className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-600">
                  Terms and conditions could not be loaded. Refresh the page to continue.
                </p>
              ) : (
                <TermsAcceptanceBlock
                  id="googleAcceptTerms"
                  terms={terms}
                  loading={termsLoading}
                  error={gErrors.acceptTerms?.message || ''}
                  register={googleForm.register('acceptTerms', {
                    onChange: () => googleForm.clearErrors('acceptTerms'),
                  })}
                />
              )}
            </>
          ) : null}

          <AuthButton
            type="submit"
            disabled={googleSubmitting || termsBlockSubmit}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[10px] bg-[#021A54] text-[17px] font-semibold text-white transition hover:bg-[#01133F] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {googleSubmitting ? (
              'Creating account...'
            ) : (
              <>
                Continue
                <ArrowRight size={19} />
              </>
            )}
          </AuthButton>

          <AuthButton
            type="button"
            onClick={() => setGoogleDraft(null)}
            className="w-full text-center text-[16px] font-semibold text-[#667085] hover:text-[#021A54]"
          >
            Use a different Google account
          </AuthButton>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-4 text-center sm:mb-5">
        <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-[#021A54] sm:text-[30px]">
          {copy.title}
        </h1>
        <p className="mt-2 text-[15px] leading-snug text-[#667085] sm:mt-2.5 sm:text-[17px]">
          {copy.subtitle}
        </p>
        {planCode && role === ROLES.ADMIN ? (
          <p className="mt-2 rounded-lg bg-[#F5F8FF] px-3 py-2 text-[14px] font-medium text-[#021A54] sm:text-[15px]">
            Selected plan: <span className="font-semibold">{planCode}</span>
            <span className="font-normal text-[#667085]">
              {' '}
              — after signup you&apos;ll pay (and can apply a discount)
            </span>
          </p>
        ) : null}
      </div>

      <GoogleSignInButton
        role={role}
        onAccessToken={handleGoogleAccessToken}
        className="flex h-[48px] w-full items-center justify-center gap-3 rounded-[10px] border border-[#D0D5DD] bg-white text-[15px] font-semibold text-[#344054] transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-60 sm:h-[52px] sm:text-[17px]"
      />

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#EAECF0]" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-2 text-center text-[12px] font-medium text-[#98A2B3] sm:px-3 sm:text-[13px]">
            or continue with email
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="firstName" className="mb-1.5 block text-[16px] font-semibold text-[#101828]">
              First name
            </label>
            <AuthInput
              id="firstName"
              placeholder="John"
              className={`${inputClass} ${errors.firstName ? 'border-red-500' : ''}`}
              {...register('firstName')}
            />
            {errors.firstName && (
              <p className="mt-1 text-xs text-red-500">{errors.firstName.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="middleName" className="mb-1.5 block text-[16px] font-semibold text-[#101828]">
              Middle name
            </label>
            <AuthInput
              id="middleName"
              placeholder="Michael"
              className={`${inputClass} ${errors.middleName ? 'border-red-500' : ''}`}
              {...register('middleName')}
            />
            {errors.middleName && (
              <p className="mt-1 text-xs text-red-500">{errors.middleName.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="lastName" className="mb-1.5 block text-[16px] font-semibold text-[#101828]">
              Last name
            </label>
            <AuthInput
              id="lastName"
              placeholder="Doe"
              className={`${inputClass} ${errors.lastName ? 'border-red-500' : ''}`}
              {...register('lastName')}
            />
            {errors.lastName && (
              <p className="mt-1 text-xs text-red-500">{errors.lastName.message}</p>
            )}
          </div>
        </div>

        {!showTenant ? (
          <div>
            <label htmlFor="phone" className="mb-1.5 block text-[16px] font-semibold text-[#101828]">
              Mobile number
            </label>
            <AuthInput
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              className={`${inputClass} ${errors.phone ? 'border-red-500' : ''}`}
              {...register('phone')}
            />
            {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>}
          </div>
        ) : null}

        <div className={`grid grid-cols-1 gap-3 ${showAffiliateType ? 'sm:grid-cols-2' : ''}`}>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-[16px] font-semibold text-[#101828]">
              Email Address
            </label>
            <div className="relative">
              <Mail
                size={19}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#98A2B3]"
              />
              <AuthInput
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                className={`${inputClass} pl-12 ${errors.email ? 'border-red-500' : ''}`}
                {...register('email')}
              />
            </div>
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
          </div>

          {showAffiliateType ? (
            <div>
              <label
                htmlFor="affiliateType"
                className="mb-1.5 block text-[16px] font-semibold text-[#101828]"
              >
                Affiliate type <span className="text-red-500">*</span>
              </label>
              <AuthSelect
                id="affiliateType"
                className={`${inputClass} ${errors.affiliateType ? 'border-red-500' : ''} ${
                  !watch('affiliateType') ? 'text-[#98A2B3]' : ''
                }`}
                {...register('affiliateType', {
                  onChange: () => clearAffiliateExtras(setValue),
                })}
              >
                <option value="">Select type</option>
                {affiliateTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </AuthSelect>
              {errors.affiliateType ? (
                <p className="mt-1 text-xs text-red-500">{errors.affiliateType.message}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        {showAffiliateType ? (
          <>
            {affiliateType === AFFILIATE_TYPES.STUDENT ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="collegeName"
                    className="mb-1.5 block text-[16px] font-semibold text-[#101828]"
                  >
                    College <span className="text-red-500">*</span>
                  </label>
                  <AuthInput
                    id="collegeName"
                    placeholder="Enter college"
                    className={`${inputClass} ${errors.collegeName ? 'border-red-500' : ''}`}
                    {...register('collegeName')}
                  />
                  {errors.collegeName ? (
                    <p className="mt-1 text-xs text-red-500">{errors.collegeName.message}</p>
                  ) : null}
                </div>
                <div>
                  <label
                    htmlFor="universityName"
                    className="mb-1.5 block text-[16px] font-semibold text-[#101828]"
                  >
                    University <span className="font-normal text-[#98A2B3]">(optional)</span>
                  </label>
                  <AuthInput
                    id="universityName"
                    placeholder="Enter university"
                    className={`${inputClass} ${errors.universityName ? 'border-red-500' : ''}`}
                    {...register('universityName')}
                  />
                  {errors.universityName ? (
                    <p className="mt-1 text-xs text-red-500">{errors.universityName.message}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {affiliateType === AFFILIATE_TYPES.SOCIAL_MEDIA_CREATOR ? (
              <div>
                <label
                  htmlFor="socialMediaAccount"
                  className="mb-1.5 block text-[16px] font-semibold text-[#101828]"
                >
                  Social media account <span className="text-red-500">*</span>
                </label>
                <AuthInput
                  id="socialMediaAccount"
                  placeholder="Instagram / YouTube / LinkedIn URL or handle"
                  className={`${inputClass} ${errors.socialMediaAccount ? 'border-red-500' : ''}`}
                  {...register('socialMediaAccount')}
                />
                {errors.socialMediaAccount ? (
                  <p className="mt-1 text-xs text-red-500">{errors.socialMediaAccount.message}</p>
                ) : null}
              </div>
            ) : null}

            {affiliateType === AFFILIATE_TYPES.FREELANCER_DIGITAL_MARKETER ||
            verificationKind ? (
              <div
                className={`grid grid-cols-1 gap-2 ${
                  affiliateType === AFFILIATE_TYPES.FREELANCER_DIGITAL_MARKETER && verificationKind
                    ? 'sm:grid-cols-2'
                    : ''
                }`}
              >
                {affiliateType === AFFILIATE_TYPES.FREELANCER_DIGITAL_MARKETER ? (
                  <VerificationDocumentField
                    label="Resume"
                    required
                    value={watch('resumeDocument') || ''}
                    fileName={watch('resumeDocumentName') || ''}
                    error={errors.resumeDocument?.message || ''}
                    onChange={(next) => {
                      setValue('resumeDocument', next.verificationDocument, {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                      setValue('resumeDocumentName', next.verificationDocumentName || '', {
                        shouldDirty: true,
                      });
                    }}
                  />
                ) : null}

                {verificationKind ? (
                  <VerificationDocumentField
                    label={verificationLabel}
                    required
                    value={watch('verificationDocument') || ''}
                    fileName={watch('verificationDocumentName') || ''}
                    error={errors.verificationDocument?.message || ''}
                    onChange={(next) => {
                      setValue('verificationDocument', next.verificationDocument, {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                      setValue('verificationDocumentName', next.verificationDocumentName || '', {
                        shouldDirty: true,
                      });
                    }}
                  />
                ) : null}
              </div>
            ) : null}

            <div>
              <label
                htmlFor="joinReason"
                className="mb-1.5 block text-[16px] font-semibold text-[#101828]"
              >
                Why do you join with us? <span className="text-red-500">*</span>
              </label>
              <AuthInput
                id="joinReason"
                type="text"
                placeholder="Give a valid answer"
                className={`${inputClass} ${errors.joinReason ? 'border-red-500' : ''}`}
                {...register('joinReason')}
              />
              {errors.joinReason ? (
                <p className="mt-1 text-xs text-red-500">{errors.joinReason.message}</p>
              ) : null}
            </div>
          </>
        ) : null}

        {showTenant && (
          <>
            <div>
              <label
                htmlFor="tenantName"
                className="mb-1.5 block text-[16px] font-semibold text-[#101828]"
              >
                Organization name
              </label>
              <AuthInput
                id="tenantName"
                placeholder="Acme Inc."
                className={`${inputClass} ${errors.tenantName ? 'border-red-500' : ''}`}
                {...register('tenantName')}
              />
              {errors.tenantName && (
                <p className="mt-1 text-xs text-red-500">{errors.tenantName.message}</p>
              )}
            </div>
            <div>
              <label
                htmlFor="category"
                className="mb-1.5 block text-[16px] font-semibold text-[#101828]"
              >
                Category <span className="text-red-500">*</span>
              </label>
              <AuthSelect
                id="category"
                className={`${inputClass} ${errors.category ? 'border-red-500' : ''} ${
                  !watch('category') ? 'text-[#98A2B3]' : ''
                }`}
                {...register('category')}
              >
                <option value="">Select category</option>
                {SHOP_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </AuthSelect>
              {errors.category && (
                <p className="mt-1 text-xs text-red-500">{errors.category.message}</p>
              )}
            </div>
            {watch('category') === SHOP_CATEGORIES.CUSTOM ? (
              <div>
                <label
                  htmlFor="customCategory"
                  className="mb-1.5 block text-[16px] font-semibold text-[#101828]"
                >
                  Custom category <span className="text-red-500">*</span>
                </label>
                <AuthInput
                  id="customCategory"
                  placeholder="e.g. Pet store"
                  className={`${inputClass} ${errors.customCategory ? 'border-red-500' : ''}`}
                  {...register('customCategory')}
                />
                {errors.customCategory && (
                  <p className="mt-1 text-xs text-red-500">{errors.customCategory.message}</p>
                )}
              </div>
            ) : null}
            <BillingFields
              register={register}
              errors={errors}
              addressValues={addressValues}
              onAddressChange={applyAddressValues(setValue)}
            />
            <LoyaltyStampModeSelector
              value={watch('loyaltyStampMode') || 'bill'}
              onChange={(v) => setValue('loyaltyStampMode', v, { shouldValidate: true, shouldDirty: true })}
            />
          </>
        )}

        {!showAffiliateType ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <PasswordField
              id="password"
              label="Password"
              autoComplete="new-password"
              placeholder="Create a strong password"
              hint="8+ chars, upper, lower, number"
              error={errors.password?.message}
              showLockIcon={false}
              {...register('password')}
            />

            <PasswordField
              id="confirmPassword"
              label="Confirm password"
              autoComplete="new-password"
              placeholder="Re-enter password"
              error={errors.confirmPassword?.message}
              showLockIcon={false}
              {...register('confirmPassword')}
            />
          </div>
        ) : null}

        {termsAudience ? (
          <>
            {termsLoadFailed ? (
              <p className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[15px] text-red-600">
                Terms and conditions could not be loaded. Refresh the page to continue.
              </p>
            ) : (
              <TermsAcceptanceBlock
                id="acceptTerms"
                terms={terms}
                loading={termsLoading}
                error={errors.acceptTerms?.message || ''}
                register={register('acceptTerms', {
                  onChange: () => clearErrors('acceptTerms'),
                })}
              />
            )}
          </>
        ) : null}

        <AuthButton
          type="submit"
          disabled={isSubmitting || termsBlockSubmit}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[10px] bg-[#021A54] text-[17px] font-semibold text-white transition hover:bg-[#01133F] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            'Please wait...'
          ) : (
            <>
              Create Account
              <ArrowRight size={19} />
            </>
          )}
        </AuthButton>
      </form>

      <p className="mt-5 border-t border-[#EAECF0] pt-5 text-center text-[15px] text-[#667085] sm:text-[16px]">
        Already have an account?{' '}
        <Link href={getLoginPath(role)} className="font-semibold text-[#2E90FA] hover:underline">
          Sign in
        </Link>
      </p>

      <div className="mt-3 flex items-center justify-center gap-1.5 text-[13px] text-[#98A2B3] sm:text-[14px]">
        <ShieldCheck size={16} />
        <span>Secure &amp; Trusted {ROLE_LABELS[role] || ''} Platform</span>
      </div>
    </div>
  );
}
