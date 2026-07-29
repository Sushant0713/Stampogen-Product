'use client';

import { createContext, useContext, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const { user, loading, role } = useAuth();

  const value = useMemo(
    () => ({
      user,
      loading,
      role,
      fullName: user
        ? [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ').trim()
        : '',
      email: user?.email || '',
      avatar: user?.avatar || null,
    }),
    [user, loading, role]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
}
