import api from '@/lib/api';

export const invoiceSettingsService = {
  get: () => api.get('/invoice-settings'),
  save: (data) => api.put('/invoice-settings', data),
};
