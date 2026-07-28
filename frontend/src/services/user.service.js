import api from '@/lib/api';

export const userService = {
  getAll: (params) => api.get('/users', { params }),
  getAffiliateStats: () => api.get('/users/affiliate-stats'),
  getById: (id) => api.get(`/users/${id}`, { timeout: 60000 }),
  createAffiliate: (data) => api.post('/users/affiliates', data, { timeout: 60000 }),
  scheduleAffiliateInterview: (id, data) =>
    api.post(`/users/affiliates/${id}/schedule-interview`, data),
  holdAffiliate: (id, data) => api.post(`/users/affiliates/${id}/hold`, data),
  resumeAffiliate: (id) => api.post(`/users/affiliates/${id}/resume`),
  requestSignedAgreementOnboarding: (id) =>
    api.post(`/users/affiliates/${id}/request-signed-agreement`),
  approveAffiliate: (id, data) =>
    api.post(`/users/affiliates/${id}/approve`, data, { timeout: 60000 }),
  resendAffiliateCredentials: (id) =>
    api.post(`/users/affiliates/${id}/resend-credentials`, {}, { timeout: 60000 }),
  rejectAffiliate: (id, data) => api.post(`/users/affiliates/${id}/reject`, data),
  getAffiliateClients: (id, params) =>
    api.get(`/users/affiliates/${id}/clients`, { params }),
  update: (id, data) => api.patch(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};
