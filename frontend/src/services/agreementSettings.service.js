import api from '@/lib/api';

export const agreementSettingsService = {
  get: (audience = 'affiliate') =>
    api.get('/agreement-settings', { params: { audience } }),
  getPublic: (audience = 'affiliate') =>
    api.get('/agreement-settings/public', { params: { audience } }),
  save: (data) => api.put('/agreement-settings', data),
};
