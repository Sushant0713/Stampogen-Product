'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { UserProvider } from '@/contexts/UserContext';
import { TenantProvider } from '@/contexts/TenantContext';

export function AppProviders({ children }) {
  return (
    <AuthProvider>
      <UserProvider>
        <TenantProvider>{children}</TenantProvider>
      </UserProvider>
    </AuthProvider>
  );
}
