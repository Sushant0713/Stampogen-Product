import { PortalLayout } from '@/components/layout/PortalLayout';
import { ROLES } from '@/constants';

export default function AdminLayout({ children }) {
  return <PortalLayout role={ROLES.ADMIN}>{children}</PortalLayout>;
}
