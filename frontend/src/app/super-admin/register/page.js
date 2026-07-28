import { AdminAuthShell } from '@/components/layout/AdminAuthShell';
import { PortalRegisterForm } from '@/features/auth/PortalRegisterForm';
import { ROLES } from '@/constants';

export const metadata = {
  title: 'Super Admin Register | Stampogen',
};

export default function SuperAdminRegisterPage() {
  return (
    <AdminAuthShell role={ROLES.SUPER_ADMIN}>
      <PortalRegisterForm role={ROLES.SUPER_ADMIN} />
    </AdminAuthShell>
  );
}
