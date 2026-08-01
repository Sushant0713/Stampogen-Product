import api from '@/lib/api';

export const platformQrService = {
  list: (params) => api.get('/platform-qr', { params }),
  getById: (id) => api.get(`/platform-qr/${id}`),
  create: (data) => api.post('/platform-qr', data),
  update: (id, data) => api.patch(`/platform-qr/${id}`, data),
  remove: (id) => api.delete(`/platform-qr/${id}`),
};
