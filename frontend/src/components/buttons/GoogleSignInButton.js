'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { authService } from '@/services/auth.service';
import { useAuth } from '@/contexts/AuthContext';
import { getErrorMessage, navigateAfterAuth, resolvePostAuthPath } from '@/utils';
import { GoogleIcon } from '@/features/auth/AuthShared';
import { toastAdminWelcome } from '@/features/auth/adminPlanToast';
import { ROLES } from '@/constants';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const GSI_SRC = 'https://accounts.google.com/gsi/client';

let gsiPromise = null;

function loadGoogleScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google sign-in is only available in the browser'));
  }

  if (window.google?.accounts?.oauth2) {
    return Promise.resolve(window.google);
  }

  if (!gsiPromise) {
    gsiPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve(window.google));
        existing.addEventListener('error', () => reject(new Error('Failed to load Google script')));
        return;
      }

      const script = document.createElement('script');
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.google);
      script.onerror = () => reject(new Error('Failed to load Google script'));
      document.head.appendChild(script);
    });
  }

  return gsiPromise;
}

export function GoogleSignInButton({
  role,
  className = '',
  label = 'Continue with Google',
  redirectTo,
  allowCreate = false,
  /** Extra fields merged into google login payload (e.g. super-admin secretCode). */
  extraPayload,
  /** If provided, parent handles the access token (e.g. register preview/complete flow). */
  onAccessToken,
}) {
  const router = useRouter();
  const { setUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const tokenClientRef = useRef(null);
  const onAccessTokenRef = useRef(onAccessToken);
  const extraPayloadRef = useRef(extraPayload);

  useEffect(() => {
    onAccessTokenRef.current = onAccessToken;
  }, [onAccessToken]);

  useEffect(() => {
    extraPayloadRef.current = extraPayload;
  }, [extraPayload]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined;

    let cancelled = false;

    loadGoogleScript()
      .then((google) => {
        if (cancelled || !google?.accounts?.oauth2) return;

        tokenClientRef.current = google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'openid email profile',
          callback: async (response) => {
            if (response.error) {
              setLoading(false);
              toast.error(response.error_description || 'Google sign-in was cancelled');
              return;
            }

            try {
              if (typeof onAccessTokenRef.current === 'function') {
                await onAccessTokenRef.current(response.access_token);
                return;
              }

              const payload = {
                accessToken: response.access_token,
                ...(extraPayloadRef.current || {}),
              };
              if (allowCreate) payload.allowCreate = true;

              const { data } = await authService.googleLogin(role, payload);

              if (data.data?.requiresApproval) {
                toast.success(
                  data.message ||
                    'Application submitted. You can sign in after approval.'
                );
                router.push(`/${role}/login`);
                return;
              }

              setUser(data.data.user);
              if (role === ROLES.ADMIN) {
                toastAdminWelcome(data.data.user);
              } else {
                toast.success('Signed in with Google');
              }

              const next = resolvePostAuthPath({
                role,
                user: data.data.user,
                redirect: redirectTo,
              });
              if (
                role === ROLES.ADMIN &&
                next.includes('/pricing') &&
                !redirectTo
              ) {
                toast('Complete payment on a plan to activate your shop.', {
                  id: 'admin-finish-payment',
                  duration: 5000,
                });
              }
              navigateAfterAuth(router, next);
            } catch (error) {
              const message = getErrorMessage(error, 'Google sign-in failed');
              if (
                role === ROLES.USER &&
                !allowCreate &&
                (error?.response?.status === 404 || /no account|register first/i.test(message))
              ) {
                toast.error('No account yet. Scan a shop QR to create one, then sign in here.');
              } else if (
                role === ROLES.USER &&
                allowCreate &&
                /already exists|sign in instead/i.test(message)
              ) {
                toast.error('Account already exists. Please sign in at /user/login');
                router.push('/user/login');
              } else {
                toast.error(message);
              }
            } finally {
              setLoading(false);
            }
          },
        });
      })
      .catch(() => {
        if (!cancelled) {
          toast.error('Unable to initialize Google sign-in');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [role, redirectTo, router, setUser, allowCreate]);

  const handleClick = useCallback(() => {
    if (!GOOGLE_CLIENT_ID) {
      toast.error('Google Client ID is not configured');
      return;
    }

    if (!tokenClientRef.current) {
      toast.error('Google sign-in is still loading. Try again in a moment.');
      return;
    }

    if (
      role === ROLES.SUPER_ADMIN &&
      !String(extraPayloadRef.current?.secretCode || '').trim()
    ) {
      toast.error('Enter the secret code before continuing with Google');
      return;
    }

    setLoading(true);
    tokenClientRef.current.requestAccessToken({ prompt: 'select_account' });
  }, [role]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      suppressHydrationWarning
      className={
        className ||
        'flex h-[52px] w-full items-center justify-center gap-3 rounded-[10px] border border-[#D0D5DD] bg-white text-[17px] font-semibold text-[#344054] transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-60'
      }
    >
      <GoogleIcon />
      {loading ? 'Connecting...' : label}
    </button>
  );
}
