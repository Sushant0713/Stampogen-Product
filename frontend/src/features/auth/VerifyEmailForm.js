'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { OtpInput } from '@/components/forms/OtpInput';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/auth.service';
import { getErrorMessage, getLoginPath, getRegisterPath, navigateAfterAuth, resolvePostAuthPath } from '@/utils';
import { ROLES } from '@/constants';
import { toastAdminWelcome } from '@/features/auth/adminPlanToast';
import {
  resolvePostSignupPaymentPath,
  saveRegistrationSession,
} from '@/utils/registrationSession';

export function VerifyEmailForm(props) {
  return (
    <Suspense fallback={null}>
      <VerifyEmailFormInner {...props} />
    </Suspense>
  );
}

function VerifyEmailFormInner({ role }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuth();
  const email = searchParams.get('email') || '';
  const planCode = searchParams.get('plan') || '';
  const discountCode = searchParams.get('discount') || '';
  const purpose = searchParams.get('purpose') === 'login' ? 'login' : 'email_verification';
  const isLoginOtp = purpose === 'login';
  const redirectParam = searchParams.get('redirect') || '';

  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!email) {
      toast.error('Email is required for verification');
      router.replace(isLoginOtp ? getLoginPath(role) : getRegisterPath(role));
    }
  }, [email, role, router, isLoginOtp]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleVerify = async (event) => {
    event.preventDefault();

    if (otp.length !== 6) {
      setError('Enter the 6-digit code');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const { data } = isLoginOtp
        ? await authService.verifyLoginOtp(role, { email, code: otp })
        : await authService.verifyEmail(role, { email, code: otp });

      if (data.data?.requiresApproval) {
        toast.success(
          data.message ||
            'Email verified. Your application is pending review. You can sign in after approval.'
        );
        router.replace(getLoginPath(role));
        return;
      }

      // Admin payment-gated signup: no User until checkout / free trial succeeds
      if (data.data?.requiresPayment && data.data?.registrationToken) {
        saveRegistrationSession({
          registrationToken: data.data.registrationToken,
          profile: data.data.profile,
        });
        const checkoutPlan = planCode || data.data.profile?.planCode || '';
        const checkoutDiscount = discountCode || data.data.profile?.discountCode || '';
        const next = await resolvePostSignupPaymentPath({
          planCode: checkoutPlan,
          discountCode: checkoutDiscount,
        });
        if (next.kind === 'trial') {
          toast.success('Email verified — start your free trial to finish registration');
        } else if (next.kind === 'checkout') {
          toast.success('Email verified — complete payment to finish registration');
        } else {
          toast.success('Email verified — choose a plan to finish registration');
        }
        window.location.assign(next.path);
        return;
      }

      setUser(data.data.user);
      if (isLoginOtp && role === ROLES.ADMIN) {
        toastAdminWelcome(data.data.user);
      } else {
        toast.success(isLoginOtp ? 'Login successful' : 'Email verified successfully');
      }

      if (isLoginOtp) {
        const next = resolvePostAuthPath({
          role,
          user: data.data.user,
          redirect: redirectParam,
        });
        navigateAfterAuth(router, next);
        return;
      }

      // Non-admin (or legacy) after email verification
      if (role === ROLES.ADMIN) {
        if (planCode) {
          const params = new URLSearchParams({ plan: planCode });
          if (discountCode) params.set('discount', discountCode);
          window.location.assign(`/checkout?${params.toString()}`);
          return;
        }
        const next = await resolvePostSignupPaymentPath({ discountCode });
        window.location.assign(next.path);
        return;
      }

      router.replace(`/${role}/dashboard`);
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid or expired OTP'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;

    try {
      setResending(true);

      if (isLoginOtp) {
        await authService.requestLoginOtp(role, { email });
      } else {
        await authService.resendOtp(role, {
          email,
          purpose: 'email_verification',
        });
      }

      setCooldown(60);
      toast.success('A new OTP has been sent');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not resend OTP'));
    } finally {
      setResending(false);
    }
  };

  if (!email) return null;

  return (
    <div className="w-full">
      <div className="mb-6 rounded-[10px] border border-[#EAECF0] bg-[#F9FAFB] px-4 py-3.5">
        <p className="text-[14px] text-[#667085]">Code sent to</p>
        <p className="mt-0.5 break-all text-[16px] font-semibold text-[#101828]">{email}</p>
      </div>

      <form onSubmit={handleVerify} className="space-y-6">
        <div>
          <p className="mb-3 text-center text-[15px] font-semibold text-[#101828]">
            Enter verification code
          </p>
          <OtpInput value={otp} onChange={setOtp} disabled={submitting} error={error} />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="flex h-12 w-full items-center justify-center rounded-[10px] bg-[#021A54] text-[16px] font-semibold text-white transition hover:bg-[#01133F] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Please wait...' : isLoginOtp ? 'Continue' : 'Verify email'}
        </button>
      </form>

      <div className="mt-6 space-y-3 text-center text-[15px]">
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || cooldown > 0}
          className="font-semibold text-[#2E90FA] hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : resending ? 'Sending...' : 'Resend OTP'}
        </button>

        <p className="text-[#667085]">
          Wrong email?{' '}
          <Link
            href={isLoginOtp ? getLoginPath(role) : getRegisterPath(role)}
            className="font-semibold text-[#2E90FA] hover:underline"
          >
            Go back
          </Link>
        </p>
      </div>
    </div>
  );
}
