import api from '@/lib/api';

export const featureService = {
  getAll: (params) => api.get('/features', { params }),
  getById: (id) => api.get(`/features/${id}`),
  create: (data) => api.post('/features', data),
  update: (id, data) => api.patch(`/features/${id}`, data),
  remove: (id) => api.delete(`/features/${id}`),
  removeMany: (ids) => api.post('/features/bulk-delete', { ids }),
};
