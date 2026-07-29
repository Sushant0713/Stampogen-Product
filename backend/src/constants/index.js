const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER: 500,
  SERVICE_UNAVAILABLE: 503,
};

const COOKIE_NAMES = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
};

const TENANT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  PENDING: 'pending',
};

const LOYALTY_STAMP_MODES = {
  BILL: 'bill',
  REQUEST: 'request',
};

const LOYALTY_STAMP_MODE_VALUES = Object.values(LOYALTY_STAMP_MODES);

const SHOP_CATEGORIES = {
  CAKE_SHOP: 'cake_shop',
  CLOTHES_SHOP: 'clothes_shop',
  CAFE: 'cafe',
  SALON: 'salon',
  GIFT_SHOP: 'gift_shop',
  CAR_WASH: 'car_wash',
  CUSTOM: 'custom',
};

const SHOP_CATEGORY_OPTIONS = [
  { value: SHOP_CATEGORIES.CAKE_SHOP, label: 'Cake shop' },
  { value: SHOP_CATEGORIES.CLOTHES_SHOP, label: 'Clothes shop' },
  { value: SHOP_CATEGORIES.CAFE, label: 'Cafe' },
  { value: SHOP_CATEGORIES.SALON, label: 'Salon' },
  { value: SHOP_CATEGORIES.GIFT_SHOP, label: 'Gift shop' },
  { value: SHOP_CATEGORIES.CAR_WASH, label: 'Car wash' },
  { value: SHOP_CATEGORIES.CUSTOM, label: 'Custom' },
];

const SHOP_CATEGORY_VALUES = SHOP_CATEGORY_OPTIONS.map((option) => option.value);

module.exports = {
  HTTP_STATUS,
  COOKIE_NAMES,
  TENANT_STATUS,
  LOYALTY_STAMP_MODES,
  LOYALTY_STAMP_MODE_VALUES,
  SHOP_CATEGORIES,
  SHOP_CATEGORY_OPTIONS,
  SHOP_CATEGORY_VALUES,
};
