'use client';

import { DashboardWelcome } from '@/features/auth/DashboardWelcome';
import { ROLES } from '@/constants';

export default function SuperAdminDashboardPage() {
  return <DashboardWelcome role={ROLES.SUPER_ADMIN} />;
}
