import { AdminAuthShell } from '@/components/layout/AdminAuthShell';
import { PortalRegisterForm } from '@/features/auth/PortalRegisterForm';
import { ROLES } from '@/constants';

export const metadata = {
  title: 'Affiliate Register | Stampogen',
};

export default function AffiliateRegisterPage() {
  return (
    <AdminAuthShell role={ROLES.AFFILIATE}>
      <PortalRegisterForm role={ROLES.AFFILIATE} />
    </AdminAuthShell>
  );
}
