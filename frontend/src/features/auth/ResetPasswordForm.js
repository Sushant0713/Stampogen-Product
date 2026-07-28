'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { ArrowRight, KeyRound } from 'lucide-react';
import { OtpInput } from '@/components/forms/OtpInput';
import { PasswordField } from '@/components/forms/PasswordField';
import { authService } from '@/services/auth.service';
import { resetPasswordSchema } from '@/lib/validations/auth';
import { getErrorMessage, getForgotPasswordPath, getLoginPath } from '@/utils';

export function ResetPasswordForm(props) {
  return (
    <Suspense fallback={null}>
      <ResetPasswordFormInner {...props} />
    </Suspense>
  );
}

function ResetPasswordFormInner({ role }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get('email') || '';
  const [resending, setResending] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: emailFromQuery,
      code: '',
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (emailFromQuery) {
      setValue('email', emailFromQuery);
    }
  }, [emailFromQuery, setValue]);

  const code = watch('code');
  const email = watch('email');

  const onSubmit = async (values) => {
    try {
      await authService.resetPassword(role, {
        email: values.email,
        code: values.code,
        password: values.password,
      });
      toast.success('Password updated. Please sign in.');
      router.push(getLoginPath(role));
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to reset password'));
    }
  };

  const handleResend = async () => {
    if (!email) {
      toast.error('Enter your email first');
      return;
    }
    try {
      setResending(true);
      await authService.resendOtp(role, { email, purpose: 'password_reset' });
      toast.success('A new reset code was sent');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to resend code'));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF2FF] text-[#021A54]">
          <KeyRound size={26} strokeWidth={1.7} />
        </div>
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-[#021A54]">
          Reset password
        </h1>
        <p className="mt-2.5 text-[16px] leading-snug text-[#667085]">
          Enter the OTP sent to your email and choose a new password.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
        <div>
          <label
            htmlFor={`${role}-reset-email`}
            className="mb-1.5 block text-[15px] font-semibold text-[#101828]"
          >
            Email Address
          </label>
          <input
            id={`${role}-reset-email`}
            type="email"
            autoComplete="email"
            className={`h-12 w-full rounded-[10px] border bg-white px-4 text-[16px] text-[#101828] outline-none transition placeholder:text-[#98A2B3] focus:border-[#021A54] focus:ring-1 focus:ring-[#021A54] ${
              errors.email ? 'border-red-500' : 'border-[#D0D5DD]'
            }`}
            {...register('email')}
          />
          {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-[15px] font-semibold text-[#101828]">
            Verification code
          </label>
          <OtpInput
            value={code}
            onChange={(next) => setValue('code', next, { shouldValidate: true })}
          />
          {errors.code && <p className="mt-1 text-sm text-red-500">{errors.code.message}</p>}
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="mt-2 text-[14px] font-semibold text-[#2E90FA] hover:underline disabled:opacity-60"
          >
            {resending ? 'Sending…' : 'Resend code'}
          </button>
        </div>

        <PasswordField
          id={`${role}-new-password`}
          label="New password"
          autoComplete="new-password"
          placeholder="Create a strong password"
          hint="8+ chars with upper, lower, and a number"
          error={errors.password?.message}
          {...register('password')}
        />

        <PasswordField
          id={`${role}-confirm-password`}
          label="Confirm new password"
          autoComplete="new-password"
          placeholder="Re-enter password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-[#021A54] text-[16px] font-semibold text-white transition hover:bg-[#01133F] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            'Please wait...'
          ) : (
            <>
              Update password
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>

      <p className="mt-8 text-center text-[15px] text-[#667085]">
        <Link
          href={getForgotPasswordPath(role)}
          className="font-semibold text-[#2E90FA] hover:underline"
        >
          Request a new code
        </Link>
        {' · '}
        <Link href={getLoginPath(role)} className="font-semibold text-[#2E90FA] hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  );
}
