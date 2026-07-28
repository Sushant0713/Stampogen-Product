'use client';

import { PortalRegisterForm } from '@/features/auth/PortalRegisterForm';
import { ROLES } from '@/constants';

export function AdminRegisterForm() {
  return <PortalRegisterForm role={ROLES.ADMIN} />;
}
