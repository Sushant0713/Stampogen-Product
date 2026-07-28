import { PortalLayout } from '@/components/layout/PortalLayout';
import { ROLES } from '@/constants';

export default function AffiliateLayout({ children }) {
  return <PortalLayout role={ROLES.AFFILIATE}>{children}</PortalLayout>;
}
