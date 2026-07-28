import { PortalLayout } from '@/components/layout/PortalLayout';
import { ROLES } from '@/constants';

export default function SuperAdminLayout({ children }) {
  return <PortalLayout role={ROLES.SUPER_ADMIN}>{children}</PortalLayout>;
}
