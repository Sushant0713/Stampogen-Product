export const ROLES = {
  SUPER_ADMIN: 'super-admin',
  ADMIN: 'admin',
  AFFILIATE: 'affiliate',
  USER: 'user',
};

export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.AFFILIATE]: 'Affiliate',
  [ROLES.USER]: 'User',
};

export const AUTH_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.AFFILIATE];

/** Customer loyalty app home */
export const CUSTOMER_APP_PATH = '/app';

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || '';

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Stampogen';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
