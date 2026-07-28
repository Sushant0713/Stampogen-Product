import { z } from 'zod';
import {
  AFFILIATE_TYPES,
  AFFILIATE_TYPE_VALUES,
  getRequiredVerificationKind,
  getVerificationDocLabel,
} from '@/constants/affiliateTypes';

export const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Valid email is required'),
});

export const resetPasswordSchema = z
  .object({
    email: z.string().email('Valid email is required'),
    code: z
      .string()
      .length(6, 'OTP must be 6 digits')
      .regex(/^\d+$/, 'OTP must be numeric'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Must include uppercase, lowercase, and a number'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const phoneSchema = z
  .string()
  .min(8, 'Phone number is required')
  .max(20, 'Phone number is too long')
  .regex(/^[0-9+\-\s()]+$/, 'Enter a valid phone number');

const streetSchema = z
  .string()
  .min(3, 'Street address is required')
  .max(300, 'Street address is too long');

const optionalGstin = z
  .string()
  .trim()
  .max(20)
  .default('')
  .refine((v) => !v || /^[0-9A-Z]{15}$/i.test(v), {
    message: 'GSTIN must be 15 characters',
  });

const optionalPan = z
  .string()
  .trim()
  .max(20)
  .default('')
  .refine((v) => !v || /^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(v), {
    message: 'Enter a valid PAN (e.g. ABCDE1234F)',
  });

const billingFields = {
  phone: phoneSchema,
  street: streetSchema,
  state: z.string().min(2, 'State is required'),
  stateCode: z.string().min(1, 'State is required'),
  city: z.string().min(2, 'City is required'),
  pin: z
    .string()
    .regex(/^\d{6}$/, 'Enter a valid 6-digit PIN code'),
  gstin: optionalGstin,
  pan: optionalPan,
};

const affiliateTypeField = z
  .string()
  .min(1, 'Please select your affiliate type')
  .refine((v) => AFFILIATE_TYPE_VALUES.includes(v), {
    message: 'Please select a valid affiliate type',
  });

const verificationDocumentField = z
  .string()
  .min(1, 'Please upload your verification document')
  .refine(
    (v) => /^data:(image\/(jpeg|jpg|png|webp)|application\/pdf);base64,/i.test(v),
    { message: 'Upload a JPG, PNG, WEBP, or PDF file' }
  );

const affiliateFields = {
  affiliateType: affiliateTypeField,
  verificationDocument: verificationDocumentField,
  verificationDocumentName: z.string().optional().default(''),
  collegeName: z.string().optional().default(''),
  universityName: z.string().optional().default(''),
  socialMediaAccount: z.string().optional().default(''),
  joinReason: z.string().optional().default(''),
  resumeDocument: z.string().optional().default(''),
  resumeDocumentName: z.string().optional().default(''),
};

function withAffiliateDocRefine(schema) {
  return schema.superRefine((data, ctx) => {
    if (!data.affiliateType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please select your affiliate type',
        path: ['affiliateType'],
      });
    }

    if (!String(data.joinReason || '').trim() || String(data.joinReason || '').trim().length < 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please tell us why you want to join',
        path: ['joinReason'],
      });
    }

    const kind = getRequiredVerificationKind(data.affiliateType);
    if (kind) {
      if (
        !data.verificationDocument ||
        !/^data:(image\/(jpeg|jpg|png|webp)|application\/pdf);base64,/i.test(
          data.verificationDocument
        )
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Please upload your ${getVerificationDocLabel(kind)}`,
          path: ['verificationDocument'],
        });
      }
    }

    if (data.affiliateType === AFFILIATE_TYPES.STUDENT) {
      if (!String(data.collegeName || '').trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'College is required',
          path: ['collegeName'],
        });
      }
    }

    if (data.affiliateType === AFFILIATE_TYPES.SOCIAL_MEDIA_CREATOR) {
      if (!String(data.socialMediaAccount || '').trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Social media account is required',
          path: ['socialMediaAccount'],
        });
      }
    }

    if (data.affiliateType === AFFILIATE_TYPES.FREELANCER_DIGITAL_MARKETER) {
      if (
        !data.resumeDocument ||
        !/^data:(image\/(jpeg|jpg|png|webp)|application\/pdf);base64,/i.test(data.resumeDocument)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Please upload your resume',
          path: ['resumeDocument'],
        });
      }
    }
  });
}

const baseRegisterSchema = z
  .object({
    firstName: z.string().min(1, 'First name is required').max(50),
    lastName: z.string().min(1, 'Last name is required').max(50),
    email: z.string().email('Valid email is required'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Must include uppercase, lowercase, and a number'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
    tenantName: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const registerSchema = baseRegisterSchema;

const acceptTermsField = z.preprocess(
  (value) => value === true || value === 'on' || value === 'true' || value === 1 || value === '1',
  z.boolean()
);

export function getRegisterSchema(role) {
  if (role === 'admin') {
    return z
      .object({
        firstName: z.string().min(1, 'First name is required').max(50),
        lastName: z.string().min(1, 'Last name is required').max(50),
        email: z.string().email('Valid email is required'),
        password: z
          .string()
          .min(8, 'Password must be at least 8 characters')
          .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
            'Must include uppercase, lowercase, and a number'
          ),
        confirmPassword: z.string().min(1, 'Confirm your password'),
        tenantName: z
          .string()
          .min(2, 'Organization name is required')
          .max(100, 'Organization name is too long'),
        loyaltyStampMode: z.enum(['bill', 'request']).default('bill'),
        acceptTerms: acceptTermsField,
        ...billingFields,
      })
      .refine((data) => data.password === data.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
      });
  }

  if (role === 'affiliate') {
    return withAffiliateDocRefine(
      z.object({
        firstName: z.string().min(1, 'First name is required').max(50),
        lastName: z.string().min(1, 'Last name is required').max(50),
        email: z.string().email('Valid email is required'),
        acceptTerms: acceptTermsField,
        ...affiliateFields,
      })
    );
  }

  return baseRegisterSchema;
}

export function getGoogleCompleteSchema(role) {
  const base = {
    firstName: z.string().min(1, 'First name is required').max(50),
    lastName: z.string().min(1, 'Last name is required').max(50),
    email: z.string().email('Valid email is required'),
    acceptTerms: acceptTermsField,
  };

  if (role === 'admin') {
    return z.object({
      ...base,
      tenantName: z
        .string()
        .min(2, 'Organization name is required')
        .max(100, 'Organization name is too long'),
      loyaltyStampMode: z.enum(['bill', 'request']).default('bill'),
      ...billingFields,
    });
  }

  if (role === 'affiliate') {
    return withAffiliateDocRefine(
      z.object({
        ...base,
        ...affiliateFields,
      })
    );
  }

  return z.object(base);
}
