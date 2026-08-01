'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { PageLoader } from '@/components/loaders/Spinner';
import { APP_NAME, ROLE_LABELS } from '@/constants';
import { navigateAfterAuth, resolvePostAuthPath } from '@/utils';
import { ShieldCheck, Building2, Users } from 'lucide-react';

const ROLE_COPY = {
  'super-admin': {
    headline: 'Platform control, simplified.',
    points: [
      'Manage tenants across the platform',
      'Secure owner-level access',
      'Built for enterprise operations',
    ],
    icon: ShieldCheck,
  },
  admin: {
    headline: 'Run your organization with clarity.',
    points: [
      'Invite and manage your team later',
      'Secure tenant-scoped access',
      'Ready for CRM, HRMS, and more',
    ],
    icon: Building2,
  },
  affiliate: {
    headline: 'Partner portal that stays simple.',
    points: [
      'Track your affiliate workspace',
      'Secure partner access',
      'Grow with the platform',
    ],
    icon: Users,
  },
};

export function AuthLayout({ children, role, title, subtitle }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, initialized, role: userRole } = useAuth();
  const copy = ROLE_COPY[role] || ROLE_COPY.admin;
  const Icon = copy.icon;
  const redirectParam = searchParams.get('redirect') || '';

  useEffect(() => {
    if (!initialized || loading) return;
    if (user && userRole === role) {
      navigateAfterAuth(
        router,
        resolvePostAuthPath({ role, user, redirect: redirectParam })
      );
    }
  }, [initialized, loading, user, userRole, role, router, redirectParam]);

  if (!initialized || loading) {
    return <PageLoader />;
  }

  if (user && userRole === role) {
    return <PageLoader />;
  }

  return (
    <div className="flex min-h-screen bg-white">
      <aside className="hidden w-[44%] flex-col justify-between bg-primary px-10 py-12 text-white lg:flex xl:w-[46%]">
        <div>
          <p className="font-display text-2xl font-semibold tracking-tight">{APP_NAME}</p>
          <p className="mt-2 text-sm text-white/70">{ROLE_LABELS[role]} Portal</p>
        </div>

        <div>
          <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-white/10">
            <Icon size={24} />
          </div>
          <h2 className="font-display text-3xl font-semibold leading-tight text-white xl:text-4xl">
            {copy.headline}
          </h2>
          <ul className="mt-8 space-y-4">
            {copy.points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm text-white/80">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-white/50">Secure authentication · Email OTP · Google sign-in</p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 lg:hidden">
            <p className="font-display text-2xl font-semibold text-primary">{APP_NAME}</p>
            <p className="mt-1 text-sm text-muted-foreground">{ROLE_LABELS[role]} Portal</p>
          </div>

          <div className="mb-8">
            <h1 className="font-display text-2xl font-semibold text-primary sm:text-[28px]">
              {title}
            </h1>
            {subtitle && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>}
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}
