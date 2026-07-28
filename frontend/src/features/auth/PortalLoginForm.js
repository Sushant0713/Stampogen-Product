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
import { getErrorMessage, getForgotPasswordPath, getRegisterPath } from '@/utils';
import { useClientMounted } from '@/hooks/useClientMounted';
import { GoogleSignInButton } from '@/components/buttons/GoogleSignInButton';
import { PasswordField } from '@/components/forms/PasswordField';
import { AuthInput, AuthButton } from '@/components/forms/AuthNativeFields';
import { loginSchema } from '@/lib/validations/auth';
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
    subtitle: 'Welcome back! Sign in with your password to access the control panel.',
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
  const { login } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const copy = LOGIN_COPY[role] || LOGIN_COPY[ROLES.ADMIN];
  const Icon = copy.Icon;
  // Admin, Super Admin, and Affiliate use email + password
  const usePasswordLogin =
    role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN || role === ROLES.AFFILIATE;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(usePasswordLogin ? loginSchema : emailOnlySchema),
    defaultValues: usePasswordLogin ? { email: '', password: '' } : { email: '' },
  });

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
        });
        if (role === ROLES.ADMIN) {
          toastAdminWelcome(loggedInUser);
        } else {
          toast.success('Welcome back');
        }
        router.push(`/${role}/dashboard`);
        return;
      }

      await authService.requestLoginOtp(role, { email: values.email });
      toast.success('Verification code sent to your email');
      router.push(
        `/${role}/verify-email?email=${encodeURIComponent(values.email)}&purpose=login`
      );
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
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF2FF]">
          <Icon />
        </div>

        <h1 className="text-[32px] font-bold leading-tight tracking-[-0.02em] text-[#021A54]">
          {copy.title}
        </h1>
        <p className="mt-2.5 text-[17px] leading-snug text-[#667085]">{copy.subtitle}</p>
      </div>

      {!mounted ? (
        <div className="space-y-3" aria-busy="true">
          <div className="h-[52px] w-full animate-pulse rounded-[10px] bg-[#F2F4F7]" />
          <div className="h-[52px] w-full animate-pulse rounded-[10px] bg-[#F2F4F7]" />
        </div>
      ) : (
        <>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <label
          htmlFor={`${role}-email`}
          className="mb-1.5 block text-[16px] font-semibold text-[#101828]"
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
            className={`h-[52px] w-full rounded-[10px] border bg-white pl-12 pr-4 text-[17px] text-[#101828] outline-none transition placeholder:text-[#98A2B3] focus:border-[#021A54] focus:ring-1 focus:ring-[#021A54] ${
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
                className="block text-[16px] font-semibold text-[#101828]"
              >
                Password
              </label>
              <Link
                href={getForgotPasswordPath(role)}
                className="text-[15px] font-semibold text-[#2E90FA] hover:underline"
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

        <AuthButton
          type="submit"
          disabled={submitting}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[10px] bg-[#021A54] text-[17px] font-semibold text-white transition hover:bg-[#01133F] disabled:cursor-not-allowed disabled:opacity-60"
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

      <div className="mt-4 flex items-start gap-2.5">
        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#EAF2FF] text-[#2E90FA]">
          <Mail size={11} />
        </span>
        <p className="text-[16px] leading-relaxed text-[#667085]">
          {usePasswordLogin ? (
            role === ROLES.AFFILIATE ? (
              <>Use the password from your approval email (or Continue with Google).</>
            ) : (
              <>Use the password you created at registration.</>
            )
          ) : (
            <>
              We&apos;ll send you a verification OTP on your email. Enter the code to securely access
              your account.
            </>
          )}
        </p>
      </div>

      <div className="relative my-7">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#EAECF0]" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-[14px] font-semibold tracking-[0.08em] text-[#98A2B3]">
            OR
          </span>
        </div>
      </div>

      <GoogleSignInButton role={role} />

      <p className="mt-8 text-center text-[16px] text-[#667085]">
        New to Stampogen?{' '}
        <Link href={getRegisterPath(role)} className="font-semibold text-[#2E90FA] hover:underline">
          Create {ROLE_LABELS[role] || 'Account'}
        </Link>
      </p>
        </>
      )}
    </div>
  );
}
