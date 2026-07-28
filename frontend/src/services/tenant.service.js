import api from '@/lib/api';

export const tenantService = {
  getAll: (params) => api.get('/tenants', { params }),
  getStats: () => api.get('/tenants/stats'),
  getById: (id) => api.get(`/tenants/${id}`),
  create: (data) => api.post('/tenants', data),
  update: (id, data) => api.patch(`/tenants/${id}`, data),
  changePlan: (id, payload) =>
    api.patch(`/tenants/${id}/plan`, typeof payload === 'string' ? { planName: payload } : payload),
  remove: (id) => api.delete(`/tenants/${id}`),
};
