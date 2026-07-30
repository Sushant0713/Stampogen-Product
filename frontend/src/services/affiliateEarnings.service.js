import api from '@/lib/api';

export const affiliateEarningsService = {
  getSummary: () => api.get('/affiliate-earnings/summary'),
  listRedeems: () => api.get('/affiliate-earnings/redeems'),
  redeem: (data = {}) => api.post('/affiliate-earnings/redeem', data),
  adminListRedeems: (params = {}) =>
    api.get('/affiliate-earnings/admin/redeems', { params }),
  adminMarkPaid: (id, data = {}) =>
    api.post(`/affiliate-earnings/admin/redeems/${encodeURIComponent(id)}/paid`, data),
  adminReject: (id, data = {}) =>
    api.post(`/affiliate-earnings/admin/redeems/${encodeURIComponent(id)}/reject`, data),
};
