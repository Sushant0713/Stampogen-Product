import api from '@/lib/api';

export const affiliateSettingsService = {
  getPublic: () => api.get('/affiliate-settings/public'),
  get: () => api.get('/affiliate-settings'),
  getMine: () => api.get('/affiliate-settings/me'),
  save: (data) => api.put('/affiliate-settings', data),
};
