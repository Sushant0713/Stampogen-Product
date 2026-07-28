'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Suspense, useEffect } from 'react';
import { Mail } from 'lucide-react';
import { Input } from '@/components/forms/Input';
import { Button } from '@/components/buttons/Button';
import { useAuth } from '@/contexts/AuthContext';
import { loginSchema } from '@/lib/validations/auth';
import { ROLE_LABELS } from '@/constants';
import { getErrorMessage, getForgotPasswordPath } from '@/utils';
import { AuthDivider } from '@/features/auth/AuthShared';
import { GoogleSignInButton } from '@/components/buttons/GoogleSignInButton';

export function LoginForm(props) {
  return (
    <Suspense fallback={null}>
      <LoginFormInner {...props} />
    </Suspense>
  );
}

function LoginFormInner({ role }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      toast.error(error);
    }
  }, [searchParams]);

  const onSubmit = async (values) => {
    try {
      await login(role, values);
      toast.success('Welcome back');
      const redirect = searchParams.get('redirect');
      if (redirect && redirect.startsWith('/')) {
        window.location.assign(redirect);
        return;
      }
      router.push(`/${role}/dashboard`);
    } catch (error) {
      const code = error?.response?.data?.code;
      const email = error?.response?.data?.email || values.email;

      if (code === 'EMAIL_NOT_VERIFIED') {
        toast('Please verify your email to continue');
        router.push(`/${role}/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }

      toast.error(getErrorMessage(error, 'Login failed'));
    }
  };

  return (
    <div>
      <GoogleSignInButton
        role={role}
        redirectTo={
          (() => {
            const redirect = searchParams.get('redirect');
            return redirect && redirect.startsWith('/') ? redirect : undefined;
          })()
        }
        className="btn-secondary flex w-full items-center justify-center gap-2 py-3 disabled:cursor-not-allowed disabled:opacity-60"
      />

      <AuthDivider label="Or sign in with email" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          id="email"
          label="Work email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          error={errors.password?.message}
          {...register('password')}
        />

        <div className="-mt-2 flex justify-end">
          <Link
            href={getForgotPasswordPath(role)}
            className="text-sm font-medium text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" loading={isSubmitting} className="w-full py-3">
          <Mail size={16} />
          Sign in with Email
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New here?{' '}
        <Link href={`/${role}/register`} className="font-medium text-primary hover:underline">
          Create a {ROLE_LABELS[role]} account
        </Link>
      </p>
    </div>
  );
}
