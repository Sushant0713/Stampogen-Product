import api from '@/lib/api';

export const discountService = {
  getPublic: () => api.get('/discounts/public'),
  getAll: (params) => api.get('/discounts', { params }),
  getStats: () => api.get('/discounts/stats'),
  getById: (id) => api.get(`/discounts/${id}`),
  create: (data) => api.post('/discounts', data),
  update: (id, data) => api.patch(`/discounts/${id}`, data),
  remove: (id) => api.delete(`/discounts/${id}`),
  removeMany: (ids) => api.post('/discounts/bulk-delete', { ids }),
};
