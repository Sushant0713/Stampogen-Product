import api from '@/lib/api';

export const superAdminDashboardService = {
  get: ({ period = 30, from = '', to = '' } = {}) =>
    api.get('/super-admin-dashboard', {
      params: {
        ...(from && to ? { from, to } : { period }),
      },
    }),
};
