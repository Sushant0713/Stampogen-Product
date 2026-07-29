'use client';

import Link from 'next/link';
import { GoogleSignInButton } from '@/components/buttons/GoogleSignInButton';
import { ROLES, CUSTOMER_APP_PATH } from '@/constants';

export function CustomerLoginPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] lg:grid lg:grid-cols-2">
      <div className="relative hidden flex-col justify-center bg-gradient-to-br from-[#021A54] via-[#0B2C6E] to-[#1E4FA3] p-16 text-white lg:flex">
        <h1 className="text-4xl font-extrabold tracking-tight text-white">My Loyalty Cards</h1>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/80">
          One Google account for every Stampogen shop. Collect stamps, unlock rewards, and keep all
          your loyalty cards in one place.
        </p>
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-[0_20px_50px_rgba(2,26,84,0.12)]">
          <h2 className="text-2xl font-extrabold text-[#021A54]">Customer sign in</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#64748B]">
            Already have a Stampogen loyalty account? Sign in with Google to open your cards.
          </p>
          <div className="mt-8">
            <GoogleSignInButton
              role={ROLES.USER}
              redirectTo={CUSTOMER_APP_PATH}
              label="Sign in with Google"
            />
          </div>
          <p className="mt-6 text-center text-xs leading-relaxed text-[#94A3B8]">
            New here? Scan a shop QR to create your account first, then come back to{' '}
            <span className="font-semibold text-[#64748B]">/user/login</span>.
          </p>
          <p className="mt-3 text-center text-xs text-[#94A3B8]">
            <Link href="/" className="font-semibold text-[#3B82F6] hover:underline">
              Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
