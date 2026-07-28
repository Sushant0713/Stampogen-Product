import api from '@/lib/api';

export const affiliateEarningsService = {
  getSummary: () => api.get('/affiliate-earnings/summary'),
  listRedeems: () => api.get('/affiliate-earnings/redeems'),
  redeem: (data = {}) => api.post('/affiliate-earnings/redeem', data),
};
