import api from '@/lib/api';

export const affiliateOnboardingService = {
  getUploadMeta: (token) =>
    api.get('/affiliate-onboarding/upload-meta', { params: { token } }),
  getCredentialsMeta: (token) =>
    api.get('/affiliate-onboarding/credentials-meta', { params: { token } }),
  uploadSignedAgreement: (data) =>
    api.post('/affiliate-onboarding/upload-signed-agreement', data, { timeout: 60000 }),
};
