'use client';

import { useAuth } from '@/contexts/AuthContext';

export function useRequireAuth(expectedRole) {
  const auth = useAuth();

  return {
    ...auth,
    isAuthorized: Boolean(auth.user) && (!expectedRole || auth.role === expectedRole),
  };
}
