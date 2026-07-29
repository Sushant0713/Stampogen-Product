import api from '@/lib/api';

export const platformInvoiceService = {
  getAll: (params = {}) => api.get('/platform-invoices', { params }),
  getStats: () => api.get('/platform-invoices/stats'),
  getFilterOptions: () => api.get('/platform-invoices/filter-options'),
  getById: (id) => api.get(`/platform-invoices/${id}`),
  getPdfBlob: (id) =>
    api.get(`/platform-invoices/${id}/pdf`, {
      responseType: 'blob',
      timeout: 60000,
    }),
  remove: (id) => api.delete(`/platform-invoices/${id}`),
  removeMany: (ids) => api.post('/platform-invoices/bulk-delete', { ids }),
};
