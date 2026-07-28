'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { ArrowRight, KeyRound, Mail } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { forgotPasswordSchema } from '@/lib/validations/auth';
import { getErrorMessage, getLoginPath, getResetPasswordPath } from '@/utils';

export function ForgotPasswordForm({ role }) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values) => {
    try {
      await authService.forgotPassword(role, { email: values.email });
      toast.success('Reset code sent to your email');
      router.push(getResetPasswordPath(role, values.email));
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to send reset code'));
    }
  };

  return (
    <div className="w-full">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF2FF] text-[#021A54]">
          <KeyRound size={26} strokeWidth={1.7} />
        </div>
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-[#021A54]">
          Forgot password
        </h1>
        <p className="mt-2.5 text-[16px] leading-snug text-[#667085]">
          Enter your account email and we&apos;ll send a one-time reset code.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <label
          htmlFor={`${role}-forgot-email`}
          className="mb-1.5 block text-[15px] font-semibold text-[#101828]"
        >
          Email Address
        </label>
        <div className="relative mb-4">
          <Mail
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#98A2B3]"
          />
          <input
            id={`${role}-forgot-email`}
            type="email"
            autoComplete="email"
            placeholder="Enter your email address"
            className={`h-12 w-full rounded-[10px] border bg-white pl-11 pr-4 text-[16px] text-[#101828] outline-none transition placeholder:text-[#98A2B3] focus:border-[#021A54] focus:ring-1 focus:ring-[#021A54] ${
              errors.email ? 'border-red-500' : 'border-[#D0D5DD]'
            }`}
            {...register('email')}
          />
        </div>
        {errors.email && (
          <p className="-mt-2 mb-3 text-sm text-red-500">{errors.email.message}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-[#021A54] text-[16px] font-semibold text-white transition hover:bg-[#01133F] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            'Please wait...'
          ) : (
            <>
              Send reset code
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-[15px] text-[#667085]">
        Remembered it?{' '}
        <Link href={getLoginPath(role)} className="font-semibold text-[#2E90FA] hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  );
}
