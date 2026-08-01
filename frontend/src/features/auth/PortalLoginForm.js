'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { ArrowRight, Handshake, Mail, Shield, ShieldCheck, User } from 'lucide-react';
import { z } from 'zod';
import { authService } from '@/services/auth.service';
import { useAuth } from '@/contexts/AuthContext';
import { getErrorMessage, getForgotPasswordPath, getRegisterPath, navigateAfterAuth, resolvePostAuthPath } from '@/utils';
import { useClientMounted } from '@/hooks/useClientMounted';
import { GoogleSignInButton } from '@/components/buttons/GoogleSignInButton';
import { PasswordField } from '@/components/forms/PasswordField';
import { AuthInput, AuthButton } from '@/components/forms/AuthNativeFields';
import { loginSchema, superAdminLoginSchema } from '@/lib/validations/auth';
import { ROLE_LABELS, ROLES } from '@/constants';
import { toastAdminWelcome } from '@/features/auth/adminPlanToast';

const emailOnlySchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

const LOGIN_COPY = {
  [ROLES.ADMIN]: {
    title: 'Admin Login',
    subtitle: 'Welcome back! Sign in with your email and password.',
    Icon: () => (
      <span className="relative inline-flex text-[#021A54]">
        <Shield size={26} strokeWidth={1.7} />
        <User
          size={12}
          strokeWidth={2.5}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[42%]"
        />
      </span>
    ),
  },
  [ROLES.SUPER_ADMIN]: {
    title: 'Super Admin Login',
    subtitle: 'Sign in with email, password, and your secret access code.',
    Icon: () => <ShieldCheck size={26} strokeWidth={1.7} className="text-[#021A54]" />,
  },
  [ROLES.AFFILIATE]: {
    title: 'Affiliate Partner Login',
    subtitle: 'Welcome back! Sign in with your email and password.',
    Icon: () => <Handshake size={26} strokeWidth={1.7} className="text-[#021A54]" />,
  },
};

export function PortalLoginForm(props) {
  return (
    <Suspense fallback={null}>
      <PortalLoginFormInner {...props} />
    </Suspense>
  );
}

function PortalLoginFormInner({ role }) {
  const mounted = useClientMounted();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, user, role: userRole, initialized, loading: authLoading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const copy = LOGIN_COPY[role] || LOGIN_COPY[ROLES.ADMIN];
  const Icon = copy.Icon;
  const isSuperAdmin = role === ROLES.SUPER_ADMIN;
  // Admin, Super Admin, and Affiliate use email + password
  const usePasswordLogin =
    role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN || role === ROLES.AFFILIATE;

  const schema = isSuperAdmin
    ? superAdminLoginSchema
    : usePasswordLogin
      ? loginSchema
      : emailOnlySchema;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: usePasswordLogin
      ? { email: '', password: '', ...(isSuperAdmin ? { secretCode: '' } : {}) }
      : { email: '' },
  });

  const secretCodeValue = isSuperAdmin ? watch('secretCode') || '' : '';
  const redirectParam = searchParams.get('redirect') || '';

  // Already signed in (e.g. abandoned checkout, then "already registered" → login)
  useEffect(() => {
    if (!initialized || authLoading) return;
    if (!user || userRole !== role) return;
    const next = resolvePostAuthPath({
      role,
      user,
      redirect: redirectParam,
    });
    if (role === ROLES.ADMIN && next.includes('/plans/browse') && !redirectParam) {
      toast('Choose a plan to finish payment and activate your shop.', {
        id: 'admin-finish-payment',
        duration: 5000,
      });
    }
    navigateAfterAuth(router, next);
  }, [initialized, authLoading, user, userRole, role, redirectParam, router]);

  useEffect(() => {
    const error = searchParams.get('error');
    const paid = searchParams.get('paid');

    if (error) {
      toast.error(error, { id: 'login-query-error' });
    }

    if (paid === '1') {
      // Fixed id collapses Strict Mode / remount duplicates into one toast
      toast.success('Payment complete. Sign in with your email and password.', {
        id: 'payment-complete',
      });
      // Remove ?paid=1 so later remounts don't fire again
      const url = new URL(window.location.href);
      url.searchParams.delete('paid');
      const next = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, '', next);
    }
  }, [searchParams]);

  const onSubmit = async (values) => {
    try {
      setSubmitting(true);

      if (usePasswordLogin) {
        const loggedInUser = await login(role, {
          email: values.email,
          password: values.password,
          ...(isSuperAdmin ? { secretCode: values.secretCode } : {}),
        });
        if (role === ROLES.ADMIN) {
          toastAdminWelcome(loggedInUser);
          const next = resolvePostAuthPath({
            role,
            user: loggedInUser,
            redirect: redirectParam,
          });
          if (next.includes('/plans/browse') && !redirectParam) {
            toast('Choose a plan to finish payment and activate your shop.', {
              id: 'admin-finish-payment',
              duration: 5000,
            });
          }
        } else {
          toast.success('Welcome back');
        }
        navigateAfterAuth(
          router,
          resolvePostAuthPath({
            role,
            user: loggedInUser,
            redirect: redirectParam,
          })
        );
        return;
      }

      await authService.requestLoginOtp(role, { email: values.email });
      toast.success('Verification code sent to your email');
      const verifyParams = new URLSearchParams({
        email: values.email,
        purpose: 'login',
      });
      if (redirectParam) verifyParams.set('redirect', redirectParam);
      router.push(`/${role}/verify-email?${verifyParams.toString()}`);
    } catch (error) {
      const code = error?.response?.data?.code;
      const email = error?.response?.data?.email || values.email;

      if (code === 'EMAIL_NOT_VERIFIED') {
        toast('Please verify your email to continue');
        router.push(`/${role}/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }

      if (code === 'AFFILIATE_NOT_APPROVED') {
        toast.error(
          getErrorMessage(
            error,
            'Your affiliate application is not approved for login yet.'
          )
        );
        return;
      }

      toast.error(getErrorMessage(error, usePasswordLogin ? 'Login failed' : 'Unable to continue'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-4 text-center sm:mb-6">
        <div className="mx-auto mb-2.5 flex h-11 w-11 items-center justify-center rounded-full bg-[#EAF2FF] sm:mb-4 sm:h-14 sm:w-14">
          <Icon />
        </div>

        <h1 className="text-[24px] font-bold leading-tight tracking-[-0.02em] text-[#021A54] sm:text-[32px]">
          {copy.title}
        </h1>
        <p className="mt-1.5 text-[14px] leading-snug text-[#667085] sm:mt-2.5 sm:text-[17px]">
          {copy.subtitle}
        </p>
      </div>

      {!mounted ? (
        <div className="space-y-3" aria-busy="true">
          <div className="h-[48px] w-full animate-pulse rounded-[10px] bg-[#F2F4F7] sm:h-[52px]" />
          <div className="h-[48px] w-full animate-pulse rounded-[10px] bg-[#F2F4F7] sm:h-[52px]" />
          {isSuperAdmin ? (
            <div className="h-[48px] w-full animate-pulse rounded-[10px] bg-[#F2F4F7] sm:h-[52px]" />
          ) : null}
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <label
              htmlFor={`${role}-email`}
              className="mb-1.5 block text-[15px] font-semibold text-[#101828] sm:text-[16px]"
            >
              Email Address
            </label>
            <div className="relative mb-4">
              <Mail
                size={19}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#98A2B3]"
              />
              <AuthInput
                id={`${role}-email`}
                type="email"
                autoComplete="email"
                placeholder="Enter your email address"
                className={`h-[48px] w-full rounded-[10px] border bg-white pl-12 pr-4 text-[16px] text-[#101828] outline-none transition placeholder:text-[#98A2B3] focus:border-[#021A54] focus:ring-1 focus:ring-[#021A54] sm:h-[52px] sm:text-[17px] ${
                  errors.email ? 'border-red-500' : 'border-[#D0D5DD]'
                }`}
                {...register('email')}
              />
            </div>
            {errors.email && (
              <p className="-mt-2 mb-3 text-sm text-red-500">{errors.email.message}</p>
            )}

            {usePasswordLogin && (
              <div className="mb-4">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label
                    htmlFor={`${role}-password`}
                    className="block text-[15px] font-semibold text-[#101828] sm:text-[16px]"
                  >
                    Password
                  </label>
                  <Link
                    href={getForgotPasswordPath(role)}
                    className="shrink-0 text-[14px] font-semibold text-[#2E90FA] hover:underline sm:text-[15px]"
                  >
                    Forgot password?
                  </Link>
                </div>
                <PasswordField
                  id={`${role}-password`}
                  label={null}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  error={errors.password?.message}
                  {...register('password')}
                />
              </div>
            )}

            {isSuperAdmin ? (
              <div className="mb-4">
                <label
                  htmlFor={`${role}-secret-code`}
                  className="mb-1.5 block text-[15px] font-semibold text-[#101828] sm:text-[16px]"
                >
                  Secret code
                </label>
                <PasswordField
                  id={`${role}-secret-code`}
                  label={null}
                  autoComplete="off"
                  placeholder="Enter secret access code"
                  error={errors.secretCode?.message}
                  {...register('secretCode')}
                />
              </div>
            ) : null}

            <AuthButton
              type="submit"
              disabled={submitting}
              className="flex h-[48px] w-full items-center justify-center gap-2 rounded-[10px] bg-[#021A54] text-[16px] font-semibold text-white transition hover:bg-[#01133F] disabled:cursor-not-allowed disabled:opacity-60 sm:h-[52px] sm:text-[17px]"
            >
              {submitting ? (
                'Please wait...'
              ) : (
                <>
                  {usePasswordLogin ? 'Sign in' : 'Continue'}
                  <ArrowRight size={17} />
                </>
              )}
            </AuthButton>
          </form>

          <div className="relative my-4 sm:my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#EAECF0]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-[13px] font-medium text-[#98A2B3] sm:text-[14px]">
                or
              </span>
            </div>
          </div>

          <GoogleSignInButton
            role={role}
            extraPayload={isSuperAdmin ? { secretCode: secretCodeValue } : undefined}
            redirectTo={redirectParam || undefined}
            className="flex h-[48px] w-full items-center justify-center gap-3 rounded-[10px] border border-[#D0D5DD] bg-white text-[15px] font-semibold text-[#344054] transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-60 sm:h-[52px] sm:text-[17px]"
          />

          <div className="mt-5 border-t border-[#EAECF0] pt-4 text-center text-[14px] text-[#667085] sm:mt-7 sm:pt-5 sm:text-[16px]">
            New to Stampogen?{' '}
            <Link
              href={getRegisterPath(role)}
              className="font-semibold text-[#2E90FA] hover:underline"
            >
              Create {ROLE_LABELS[role] || 'Account'}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
