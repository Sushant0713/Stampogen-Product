'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Input } from '@/components/forms/Input';
import { Button } from '@/components/buttons/Button';
import { getRegisterSchema } from '@/lib/validations/auth';
import { authService } from '@/services/auth.service';
import { ROLE_LABELS, ROLES } from '@/constants';
import { getErrorMessage, getLoginPath } from '@/utils';
import { AuthDivider } from '@/features/auth/AuthShared';
import { GoogleSignInButton } from '@/components/buttons/GoogleSignInButton';

export function RegisterForm({ role }) {
  const router = useRouter();
  const schema = getRegisterSchema(role);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      tenantName: '',
    },
  });

  const onSubmit = async (values) => {
    try {
      const payload = {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: values.password,
      };

      if (role === ROLES.ADMIN) {
        payload.tenantName = values.tenantName;
      }

      const { data } = await authService.register(role, payload);

      if (data.data?.requiresVerification) {
        toast.success('OTP sent to your email');
        router.push(`/${role}/verify-email?email=${encodeURIComponent(values.email)}`);
        return;
      }

      toast.success('Registration successful');
      router.push(`/${role}/dashboard`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Registration failed'));
    }
  };

  return (
    <div>
      <GoogleSignInButton
        role={role}
        allowCreate
        className="btn-secondary flex w-full items-center justify-center gap-2 py-3 disabled:cursor-not-allowed disabled:opacity-60"
      />

      <AuthDivider label="Or register with email" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            id="firstName"
            label="First name"
            placeholder="John"
            error={errors.firstName?.message}
            {...register('firstName')}
          />
          <Input
            id="lastName"
            label="Last name"
            placeholder="Doe"
            error={errors.lastName?.message}
            {...register('lastName')}
          />
        </div>

        <Input
          id="email"
          label="Work email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          error={errors.email?.message}
          {...register('email')}
        />

        {role === ROLES.ADMIN && (
          <Input
            id="tenantName"
            label="Organization name"
            placeholder="Acme Inc."
            error={errors.tenantName?.message}
            {...register('tenantName')}
          />
        )}

        <Input
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="Create a strong password"
          hint="At least 8 characters with uppercase, lowercase, and a number"
          error={errors.password?.message}
          {...register('password')}
        />

        <Input
          id="confirmPassword"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <Button type="submit" loading={isSubmitting} className="w-full py-3">
          Create account
        </Button>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          We&apos;ll send a 6-digit OTP to verify your email before activating your account.
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href={getLoginPath(role)} className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
