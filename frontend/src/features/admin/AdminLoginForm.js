'use client';

import { PortalLoginForm } from '@/features/auth/PortalLoginForm';
import { ROLES } from '@/constants';

export function AdminLoginForm() {
  return <PortalLoginForm role={ROLES.ADMIN} />;
}
