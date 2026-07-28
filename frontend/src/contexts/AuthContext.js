'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authService } from '@/services/auth.service';
import { setUnauthorizedHandler } from '@/lib/api';
import { getRoleSlug } from '@/utils';

const AuthContext = createContext(null);
const SESSION_POLL_MS = 90000;

function sameUser(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    String(a._id || a.id) === String(b._id || b.id) &&
    a.email === b.email &&
    a.isActive === b.isActive &&
    a.isEmailVerified === b.isEmailVerified &&
    getRoleSlug(a) === getRoleSlug(b) &&
    String(a.tenant?._id || a.tenant || '') === String(b.tenant?._id || b.tenant || '') &&
    String(a.tenant?.status || '') === String(b.tenant?.status || '')
  );
}

function isTenantBlocked(user) {
  const status = user?.tenant?.status;
  return status === 'suspended' || status === 'inactive';
}

function isProtectedAppPath(pathname = '') {
  return (
    pathname.includes('/dashboard') ||
    pathname.startsWith('/super-admin/') ||
    pathname.startsWith('/app')
  );
}

function shouldSkipInitialMe() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname || '';
  // Public / auth chrome — don't block first paint on /auth/me
  // Keep /checkout out: it must wait for session or it bounces verified users to register → dashboard
  return (
    path === '/' ||
    path === '/pricing' ||
    path.startsWith('/pricing/') ||
    path === '/features' ||
    path.startsWith('/features/') ||
    path.includes('/login') ||
    path.includes('/register') ||
    path.includes('/verify-email') ||
    path.includes('/forgot-password') ||
    path.includes('/reset-password') ||
    path.startsWith('/join/')
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const userRef = useRef(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const clearSession = useCallback(() => {
    setUser(null);
  }, []);

  const applyUser = useCallback((next) => {
    setUser((prev) => (sameUser(prev, next) ? prev : next));
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      const { data } = await authService.me();
      const next = data.data.user;
      if (isTenantBlocked(next)) {
        setUser(null);
        return null;
      }
      applyUser(next);
      return next;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [applyUser]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (userRef.current) {
        setUser(null);
      }
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let active = true;

    const init = async () => {
      // Marketing pages: paint immediately, resolve session in background
      if (shouldSkipInitialMe()) {
        if (active) {
          setLoading(false);
          setInitialized(true);
        }
        try {
          const { data } = await authService.me();
          if (!active) return;
          const next = data.data.user;
          if (isTenantBlocked(next)) setUser(null);
          else applyUser(next);
        } catch {
          if (active) setUser(null);
        }
        return;
      }

      try {
        const { data } = await authService.me();
        if (active) {
          const next = data.data.user;
          if (isTenantBlocked(next)) {
            setUser(null);
          } else {
            applyUser(next);
          }
        }
      } catch {
        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };

    init();

    return () => {
      active = false;
    };
  }, [applyUser]);

  // Poll only on dashboard routes — focus/visibility for faster kick on suspend
  useEffect(() => {
    if (!user) return undefined;

    let cancelled = false;
    let focusTimer;

    const checkSession = async () => {
      if (!isProtectedAppPath(window.location.pathname)) return;

      try {
        const { data } = await authService.me();
        if (cancelled) return;
        const next = data?.data?.user;
        if (!next || isTenantBlocked(next)) {
          setUser(null);
          return;
        }
        applyUser(next);
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      }
    };

    const intervalId = setInterval(checkSession, SESSION_POLL_MS);

    const onFocus = () => {
      window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(checkSession, 800);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onFocus();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      window.clearTimeout(focusTimer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user, applyUser]);

  const login = useCallback(async (role, credentials) => {
    const { data } = await authService.login(role, credentials);
    setUser(data.data.user);
    return data.data.user;
  }, []);

  const register = useCallback(async (role, payload) => {
    const { data } = await authService.register(role, payload);

    if (data.data?.requiresVerification) {
      return data.data;
    }

    setUser(data.data.user);
    return data.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      initialized,
      isAuthenticated: Boolean(user),
      role: getRoleSlug(user),
      login,
      register,
      logout,
      refreshUser: fetchUser,
      clearSession,
      setUser,
    }),
    [user, loading, initialized, login, register, logout, fetchUser, clearSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
