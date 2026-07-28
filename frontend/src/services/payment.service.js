import api from '@/lib/api';

export const paymentService = {
  getConfig: () => api.get('/payments/config'),
  preview: (data) => api.post('/payments/preview', data),
  createOrder: (data) => api.post('/payments/create-order', data),
  verify: (data) => api.post('/payments/verify', data),
};
