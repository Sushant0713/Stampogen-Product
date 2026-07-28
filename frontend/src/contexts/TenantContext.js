'use client';

import { createContext, useContext, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const TenantContext = createContext(null);

export function TenantProvider({ children }) {
  const { user } = useAuth();

  const value = useMemo(
    () => ({
      tenant: user?.tenant || null,
      tenantId: user?.tenant?._id || user?.tenant || null,
      tenantName: user?.tenant?.name || null,
      tenantSlug: user?.tenant?.slug || null,
      tenantStatus: user?.tenant?.status || null,
    }),
    [user]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return context;
}
