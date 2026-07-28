'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { GoogleSignInButton } from '@/components/buttons/GoogleSignInButton';
import { PageLoader } from '@/components/loaders/Spinner';
import { loyaltyService } from '@/services/loyalty.service';
import { useAuth } from '@/contexts/AuthContext';
import { ROLES, CUSTOMER_APP_PATH } from '@/constants';
import { getErrorMessage, getRoleSlug } from '@/utils';
import { shopInitials } from '@/features/customer/customerTheme';

export function CustomerJoinPage({ slug }) {
  const router = useRouter();
  const { user, loading, initialized } = useAuth();
  const [shop, setShop] = useState(null);
  const [shopLoading, setShopLoading] = useState(true);
  const [joining, setJoining] = useState(false);

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
    if (!initialized || loading || !user) return;
    if (getRoleSlug(user) !== ROLES.USER) {
      toast.error('Please sign in with a customer account');
      return;
    }
    completeJoin();
  }, [initialized, loading, user, completeJoin]);

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

  if (initialized && !loading && user && getRoleSlug(user) === ROLES.USER) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <PageLoader />
      </div>
    );
  }

  const redirectTo = `/join/${slug}?link=1`;

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
              <h1 className="text-3xl font-extrabold tracking-tight">{shop.name}</h1>
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
          <h2 className="text-2xl font-extrabold text-[#021A54]">Join {shop.name}</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#64748B]">
            Continue with Google to create your Stampogen wallet (or sign in if you already have
            one) and add this shop to your cards.
          </p>
          <div className="mt-8">
            <GoogleSignInButton
              role={ROLES.USER}
              allowCreate
              redirectTo={redirectTo}
              label="Continue with Google"
            />
          </div>
          <p className="mt-6 text-center text-xs text-[#94A3B8]">
            Already have cards?{' '}
            <Link href="/user/login" className="font-semibold text-[#3B82F6] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
