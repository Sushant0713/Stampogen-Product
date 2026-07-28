import api from '@/lib/api';

export const loyaltyService = {
  shopPreview: (slug) => api.get(`/loyalty/shops/${encodeURIComponent(slug)}/preview`),
  join: (tenantSlug) => api.post('/loyalty/join', { tenantSlug }),
  listCards: () => api.get('/loyalty/cards'),
  getCard: (slug) => api.get(`/loyalty/cards/${encodeURIComponent(slug)}`),
  listRewards: () => api.get('/loyalty/rewards'),
  addStamp: (slug, payload = {}) =>
    api.post(`/loyalty/cards/${encodeURIComponent(slug)}/stamps`, payload, { timeout: 60000 }),
  requestStamp: (slug, payload = {}) =>
    api.post(`/loyalty/cards/${encodeURIComponent(slug)}/stamp-requests`, payload),
  redeem: (slug) => api.post(`/loyalty/cards/${encodeURIComponent(slug)}/redeem`),
  adminListRewards: (filter = 'pending') =>
    api.get('/loyalty/admin/rewards', { params: { filter } }),
  adminListStampRequests: () => api.get('/loyalty/admin/stamp-requests'),
  adminApproveStampRequest: (id) =>
    api.post(`/loyalty/admin/stamp-requests/${encodeURIComponent(id)}/approve`),
  adminRejectStampRequest: (id) =>
    api.post(`/loyalty/admin/stamp-requests/${encodeURIComponent(id)}/reject`),
  adminGetSettings: () => api.get('/loyalty/admin/settings'),
  adminUpdateSettings: (payload) => api.patch('/loyalty/admin/settings', payload),
  adminListCustomers: () => api.get('/loyalty/admin/customers'),
  adminUpdateCustomer: (id, payload) =>
    api.patch(`/loyalty/admin/customers/${encodeURIComponent(id)}`, payload),
  adminDeleteCustomer: (id) => api.delete(`/loyalty/admin/customers/${encodeURIComponent(id)}`),
  adminStats: () => api.get('/loyalty/admin/stats'),
  adminListOffers: () => api.get('/loyalty/admin/offers'),
  adminCreateOffer: (payload) => api.post('/loyalty/admin/offers', payload),
  adminUpdateOffer: (key, payload) =>
    api.patch(`/loyalty/admin/offers/${encodeURIComponent(key)}`, payload),
  adminGetReward: (id) => api.get(`/loyalty/admin/rewards/${encodeURIComponent(id)}`),
  adminVerify: (id) => api.post(`/loyalty/admin/rewards/${encodeURIComponent(id)}/verify`),
  adminCancel: (id) => api.post(`/loyalty/admin/rewards/${encodeURIComponent(id)}/cancel`),
  adminGive: (id) => api.post(`/loyalty/admin/rewards/${encodeURIComponent(id)}/give`),
};
