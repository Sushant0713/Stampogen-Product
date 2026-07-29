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

export const SHOP_CATEGORIES = {
  CAKE_SHOP: 'cake_shop',
  CLOTHES_SHOP: 'clothes_shop',
  CAFE: 'cafe',
  SALON: 'salon',
  GIFT_SHOP: 'gift_shop',
  CAR_WASH: 'car_wash',
  CUSTOM: 'custom',
};

export const SHOP_CATEGORY_OPTIONS = [
  { value: SHOP_CATEGORIES.CAKE_SHOP, label: 'Cake shop' },
  { value: SHOP_CATEGORIES.CLOTHES_SHOP, label: 'Clothes shop' },
  { value: SHOP_CATEGORIES.CAFE, label: 'Cafe' },
  { value: SHOP_CATEGORIES.SALON, label: 'Salon' },
  { value: SHOP_CATEGORIES.GIFT_SHOP, label: 'Gift shop' },
  { value: SHOP_CATEGORIES.CAR_WASH, label: 'Car wash' },
  { value: SHOP_CATEGORIES.CUSTOM, label: 'Custom' },
];

export const SHOP_CATEGORY_VALUES = SHOP_CATEGORY_OPTIONS.map((option) => option.value);
