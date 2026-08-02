import api from '@/lib/api';

export const platformTrialSettingsService = {
  getPublic: () => api.get('/platform-trial-settings/public'),
  get: () => api.get('/platform-trial-settings'),
  save: (data) => api.put('/platform-trial-settings', data),
};
