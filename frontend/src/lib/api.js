import axios from 'axios';
import { API_URL } from '@/constants';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue = [];
let unauthorizedHandler = null;

/** AuthProvider registers this so deleted/expired sessions clear UI without a full page refresh. */
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === 'function' ? handler : null;
}

function notifyUnauthorized() {
  if (unauthorizedHandler) {
    unauthorizedHandler();
  }
}

const processQueue = (error = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

const shouldSkipRefresh = (url = '') => {
  return [
    '/auth/login',
    '/auth/register',
    '/auth/refresh',
    '/auth/me',
    '/auth/login-otp',
    '/auth/verify-login-otp',
    '/auth/verify-email',
    '/auth/resend-otp',
    '/auth/logout',
    '/auth/google',
    '/plans/public',
    '/payments/',
    '/affiliate-onboarding/',
  ].some((path) => url.includes(path));
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest || error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (shouldSkipRefresh(originalRequest.url || '')) {
      notifyUnauthorized();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then(() => api(originalRequest))
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      await api.post('/auth/refresh');
      processQueue();
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError);
      notifyUnauthorized();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
