import api from '@/lib/api';

function withOutletScope(params = {}, outletTenantId) {
  const next = { ...params };
  if (outletTenantId) next.outletTenantId = outletTenantId;
  return next;
}

function withOutletBody(payload = {}, outletTenantId) {
  if (!outletTenantId) return payload;
  return { ...payload, outletTenantId };
}

export const loyaltyService = {
  shopPreview: (slug) => api.get(`/loyalty/shops/${encodeURIComponent(slug)}/preview`),
  join: (tenantSlug) => api.post('/loyalty/join', { tenantSlug }),
  listCards: () => api.get('/loyalty/cards'),
  getCard: (slug) => api.get(`/loyalty/cards/${encodeURIComponent(slug)}`),
  listRewards: () => api.get('/loyalty/rewards'),
  listHistory: () => api.get('/loyalty/history'),
  addStamp: (slug, payload = {}) =>
    api.post(`/loyalty/cards/${encodeURIComponent(slug)}/stamps`, payload, { timeout: 60000 }),
  requestStamp: (slug, payload = {}) =>
    api.post(`/loyalty/cards/${encodeURIComponent(slug)}/stamp-requests`, payload),
  redeem: (slug) => api.post(`/loyalty/cards/${encodeURIComponent(slug)}/redeem`),
  adminListRewards: (filter = 'pending', { outletTenantId } = {}) =>
    api.get('/loyalty/admin/rewards', {
      params: withOutletScope({ filter }, outletTenantId),
    }),
  adminListStampRequests: ({ outletTenantId } = {}) =>
    api.get('/loyalty/admin/stamp-requests', {
      params: withOutletScope({}, outletTenantId),
    }),
  adminListRecentBillStamps: () => api.get('/loyalty/admin/recent-bill-stamps'),
  adminApproveStampRequest: (id, { outletTenantId } = {}) =>
    api.post(
      `/loyalty/admin/stamp-requests/${encodeURIComponent(id)}/approve`,
      withOutletBody({}, outletTenantId)
    ),
  adminRejectStampRequest: (id, { outletTenantId } = {}) =>
    api.post(
      `/loyalty/admin/stamp-requests/${encodeURIComponent(id)}/reject`,
      withOutletBody({}, outletTenantId)
    ),
  adminGetSettings: () => api.get('/loyalty/admin/settings'),
  adminUpdateSettings: (payload) => api.patch('/loyalty/admin/settings', payload),
  adminListCustomers: ({ outletTenantId } = {}) =>
    api.get('/loyalty/admin/customers', {
      params: withOutletScope({}, outletTenantId),
    }),
  adminGetCustomer: (id, { outletTenantId } = {}) =>
    api.get(`/loyalty/admin/customers/${encodeURIComponent(id)}`, {
      params: withOutletScope({}, outletTenantId),
    }),
  adminUpdateCustomer: (id, payload, { outletTenantId } = {}) =>
    api.patch(
      `/loyalty/admin/customers/${encodeURIComponent(id)}`,
      withOutletBody(payload, outletTenantId)
    ),
  adminDeleteCustomer: (id, { outletTenantId } = {}) =>
    api.delete(`/loyalty/admin/customers/${encodeURIComponent(id)}`, {
      params: withOutletScope({}, outletTenantId),
    }),
  adminStats: ({ outletTenantId } = {}) =>
    api.get('/loyalty/admin/stats', {
      params: withOutletScope({}, outletTenantId),
    }),
  adminListOffers: () => api.get('/loyalty/admin/offers'),
  adminCreateOffer: (payload) => api.post('/loyalty/admin/offers', payload),
  adminUpdateOffer: (key, payload) =>
    api.patch(`/loyalty/admin/offers/${encodeURIComponent(key)}`, payload),
  adminGetReward: (id, { outletTenantId } = {}) =>
    api.get(`/loyalty/admin/rewards/${encodeURIComponent(id)}`, {
      params: withOutletScope({}, outletTenantId),
    }),
  adminVerify: (id, { outletTenantId } = {}) =>
    api.post(
      `/loyalty/admin/rewards/${encodeURIComponent(id)}/verify`,
      withOutletBody({}, outletTenantId)
    ),
  adminCancel: (id, { outletTenantId } = {}) =>
    api.post(
      `/loyalty/admin/rewards/${encodeURIComponent(id)}/cancel`,
      withOutletBody({}, outletTenantId)
    ),
  adminGive: (id, { outletTenantId } = {}) =>
    api.post(
      `/loyalty/admin/rewards/${encodeURIComponent(id)}/give`,
      withOutletBody({}, outletTenantId)
    ),
};
