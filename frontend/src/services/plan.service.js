import api from '@/lib/api';

export const planService = {
  getPublic: ({ force = false, forOutlet = false } = {}) =>
    api.get('/plans/public', {
      params: {
        ...(forOutlet ? { forOutlet: '1' } : {}),
        ...(force ? { _t: Date.now() } : {}),
      },
      ...(force
        ? {
            headers: {
              'Cache-Control': 'no-cache',
              Pragma: 'no-cache',
            },
          }
        : {}),
    }),
  getAll: (params) => api.get('/plans', { params }),
  getById: (id) => api.get(`/plans/${id}`),
  create: (data) => api.post('/plans', data),
  update: (id, data) => api.patch(`/plans/${id}`, data),
  remove: (id) => api.delete(`/plans/${id}`),
  removeMany: (ids) => api.post('/plans/bulk-delete', { ids }),
};
