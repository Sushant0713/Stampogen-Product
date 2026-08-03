import api from '@/lib/api';

export const outletService = {
  dashboard: () => api.get('/outlets/dashboard'),
  listSeats: () => api.get('/outlets/seats'),
  create: (data) => api.post('/outlets', data),
};
