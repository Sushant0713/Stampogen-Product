import api from '@/lib/api';
import { API_URL } from '@/constants';

const resolveApiUrl = (path) => {
  if (API_URL.startsWith('http')) {
    return `${API_URL}${path}`;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${API_URL}${path}`;
  }
  return `${API_URL}${path}`;
};

export const authService = {
  register: (role, data) => api.post(`/auth/register/${role}`, data),
  login: (role, data) => api.post(`/auth/login/${role}`, data),
  requestLoginOtp: (role, data) => api.post(`/auth/login-otp/${role}`, data),
  verifyLoginOtp: (role, data) => api.post(`/auth/verify-login-otp/${role}`, data),
  verifyEmail: (role, data) => api.post(`/auth/verify-email/${role}`, data),
  resendOtp: (role, data) => api.post(`/auth/resend-otp/${role}`, data),
  forgotPassword: (role, data) => api.post(`/auth/forgot-password/${role}`, data),
  resetPassword: (role, data) => api.post(`/auth/reset-password/${role}`, data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  refresh: () => api.post('/auth/refresh'),
  getGoogleAuthUrl: (role) => resolveApiUrl(`/auth/google/${role}`),
  googleLogin: (role, payload) => api.post(`/auth/google/${role}`, payload),
  googleProfile: (payload) => api.post('/auth/google/profile', payload),
};
