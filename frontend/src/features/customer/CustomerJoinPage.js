'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { GoogleSignInButton } from '@/components/buttons/GoogleSignInButton';
import { PageLoader } from '@/components/loaders/Spinner';
import { AuthInput } from '@/components/forms/AuthNativeFields';
import { loyaltyService } from '@/services/loyalty.service';
import { authService } from '@/services/auth.service';
import { useAuth } from '@/contexts/AuthContext';
import { ROLES, CUSTOMER_APP_PATH } from '@/constants';
import { getErrorMessage, getRoleSlug } from '@/utils';
import { shopInitials } from '@/features/customer/customerTheme';
import { customerGoogleCompleteSchema } from '@/lib/validations/auth';

const inputClass =
  'h-12 w-full rounded-[10px] border border-[#D0D5DD] bg-white px-4 text-[15px] text-[#101828] outline-none transition placeholder:text-[#98A2B3] focus:border-[#021A54] focus:ring-1 focus:ring-[#021A54]';

export function CustomerJoinPage({ slug }) {
  const router = useRouter();
  const { user, loading, initialized, setUser } = useAuth();
  const [shop, setShop] = useState(null);
  const [shopLoading, setShopLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [googleDraft, setGoogleDraft] = useState(null);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(customerGoogleCompleteSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      birthDate: '',
      phone: '',
      email: '',
    },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setShopLoading(true);
        const { data } = await loyaltyService.shopPreview(slug);
        if (!cancelled) setShop(data.data.shop);
      } catch (error) {
        if (!cancelled) toast.error(getErrorMessage(error, 'Shop not found'));
      } finally {
        if (!cancelled) setShopLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const completeJoin = useCallback(async () => {
    try {
      setJoining(true);
      const { data } = await loyaltyService.join(slug);
      const msg = data.data.alreadyMember
        ? `Welcome back to ${shop?.name || 'this shop'}!`
        : `You joined ${shop?.name || 'this shop'}!`;
      toast.success(msg);
      router.replace(`/app/cards/${encodeURIComponent(slug)}/offers`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to join shop'));
    } finally {
      setJoining(false);
    }
  }, [router, shop?.name, slug]);

  useEffect(() => {
    if (!initialized || loading || !user || googleDraft) return;
    if (getRoleSlug(user) !== ROLES.USER) {
      toast.error('Please sign in with a customer account');
      return;
    }
    completeJoin();
  }, [initialized, loading, user, completeJoin, googleDraft]);

  const handleGoogleAccessToken = useCallback(
    async (accessToken) => {
      try {
        const { data } = await authService.googleProfile({ accessToken });
        const profile = data.data.profile;

        if (profile.accountExists) {
          if (profile.role && profile.role !== ROLES.USER) {
            toast.error('This Google account belongs to a different portal');
            return;
          }

          const loginRes = await authService.googleLogin(ROLES.USER, { accessToken });
          setUser(loginRes.data.data.user);
          toast.success('Signed in with Google');
          return;
        }

        setGoogleDraft({ accessToken, profile });
        reset({
          firstName: profile.firstName || '',
          lastName: profile.lastName || '',
          birthDate: '',
          phone: '',
          email: profile.email || '',
        });
        toast.success('Complete your profile to join');
      } catch (error) {
        toast.error(getErrorMessage(error, 'Unable to continue with Google'));
      }
    },
    [reset, setUser]
  );

  const onGoogleComplete = async (values) => {
    if (!googleDraft?.accessToken) {
      toast.error('Google session expired. Please continue with Google again.');
      setGoogleDraft(null);
      return;
    }

    try {
      setGoogleSubmitting(true);
      const { data } = await authService.googleLogin(ROLES.USER, {
        accessToken: googleDraft.accessToken,
        allowCreate: true,
        firstName: values.firstName.trim(),
        middleName: '',
        lastName: values.lastName.trim(),
        birthDate: String(values.birthDate || '').trim(),
        phone: values.phone.trim(),
      });
      setUser(data.data.user);
      setGoogleDraft(null);
      toast.success('Account created');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to create account'));
    } finally {
      setGoogleSubmitting(false);
    }
  };

  if (shopLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <PageLoader />
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] p-8 text-center">
        <p className="text-xl font-extrabold text-[#021A54]">Shop not found</p>
        <Link href={CUSTOMER_APP_PATH} className="mt-4 text-sm font-semibold text-[#3B82F6]">
          Go to my cards
        </Link>
      </div>
    );
  }

  if (initialized && !loading && user && getRoleSlug(user) === ROLES.USER && !googleDraft) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] lg:grid lg:grid-cols-2">
      <div className="relative flex flex-col justify-center overflow-hidden bg-gradient-to-br from-[#021A54] via-[#0B2C6E] to-[#1E4FA3] p-10 text-white lg:p-16">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10" />
        <div className="relative z-[1] max-w-md">
          <p className="text-sm font-semibold text-white/70">Stampogen Loyalty</p>
          <div className="mt-6 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold">
              {shop.initials || shopInitials(shop.name)}
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white">
                {shop.name}
              </h1>
              <p className="mt-1 text-sm text-white/70">{shop.campaign}</p>
            </div>
          </div>
          <p className="mt-8 text-[15px] leading-relaxed text-white/80">
            Collect {shop.stampsRequired} stamps and unlock{' '}
            <span className="font-semibold text-white">{shop.reward}</span>. One Google account
            works across every Stampogen shop you visit.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-[0_20px_50px_rgba(2,26,84,0.12)]">
          {googleDraft ? (
            <>
              <h2 className="text-2xl font-extrabold text-[#021A54]">Complete your profile</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#64748B]">
                First name, last name, and mobile number are required to join {shop.name}. Birth date
                is optional.
              </p>
              <form onSubmit={handleSubmit(onGoogleComplete)} className="mt-6 space-y-3" noValidate>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#101828]">First name</label>
                    <AuthInput
                      className={`${inputClass} ${errors.firstName ? 'border-red-500' : ''}`}
                      {...register('firstName')}
                    />
                    {errors.firstName && (
                      <p className="mt-1 text-xs text-red-500">{errors.firstName.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#101828]">Last name</label>
                    <AuthInput
                      className={`${inputClass} ${errors.lastName ? 'border-red-500' : ''}`}
                      {...register('lastName')}
                    />
                    {errors.lastName && (
                      <p className="mt-1 text-xs text-red-500">{errors.lastName.message}</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-[#101828]">Email</label>
                  <AuthInput
                    type="email"
                    readOnly
                    className={`${inputClass} bg-[#F9FAFB] text-[#667085]`}
                    {...register('email')}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#101828]">
                      Birth date <span className="font-normal text-[#98A2B3]">(optional)</span>
                    </label>
                    <AuthInput
                      type="date"
                      className={`${inputClass} ${errors.birthDate ? 'border-red-500' : ''}`}
                      {...register('birthDate')}
                    />
                    {errors.birthDate && (
                      <p className="mt-1 text-xs text-red-500">{errors.birthDate.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-[#101828]">Mobile number</label>
                    <AuthInput
                      type="tel"
                      autoComplete="tel"
                      placeholder="+91 98765 43210"
                      className={`${inputClass} ${errors.phone ? 'border-red-500' : ''}`}
                      {...register('phone')}
                    />
                    {errors.phone && (
                      <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>
                    )}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={googleSubmitting || joining}
                  className="mt-2 flex h-12 w-full items-center justify-center rounded-[10px] bg-[#021A54] text-[15px] font-bold text-white transition hover:bg-[#032066] disabled:opacity-60"
                >
                  {googleSubmitting ? 'Creating account…' : `Join ${shop.name}`}
                </button>
                <button
                  type="button"
                  onClick={() => setGoogleDraft(null)}
                  className="w-full text-center text-sm font-semibold text-[#64748B] hover:text-[#021A54]"
                >
                  Use a different Google account
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-extrabold text-[#021A54]">Join {shop.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#64748B]">
                Continue with Google to create your Stampogen wallet (or sign in if you already have
                one) and add this shop to your cards.
              </p>
              <div className="mt-8">
                <GoogleSignInButton
                  role={ROLES.USER}
                  allowCreate
                  onAccessToken={handleGoogleAccessToken}
                  label="Continue with Google"
                />
              </div>
              <p className="mt-6 text-center text-xs text-[#94A3B8]">
                Already have cards?{' '}
                <Link href="/user/login" className="font-semibold text-[#3B82F6] hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
