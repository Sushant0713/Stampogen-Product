export { PortalPlaceholder } from '@/features/super-admin/PortalPlaceholder';
export { ClientManagement } from '@/features/super-admin/ClientManagement';
export { PlanList } from '@/features/super-admin/PlanList';
export { DiscountList } from '@/features/super-admin/DiscountList';
export { FeatureList } from '@/features/super-admin/FeatureList';
export { InvoiceSettings } from '@/features/super-admin/InvoiceSettings';
export {
  InvoicePreview,
  TAX_MODES,
  normalizeTaxMode,
  calcItem,
} from '@/features/super-admin/InvoicePreview';

export const superAdminFeature = {
  name: 'super-admin',
  ready: false,
};
