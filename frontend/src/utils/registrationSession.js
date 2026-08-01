const REGISTRATION_TOKEN_KEY = 'stampogen.registrationToken';
const REGISTRATION_PROFILE_KEY = 'stampogen.registrationProfile';

export function saveRegistrationSession({ registrationToken, profile } = {}) {
  if (typeof window === 'undefined') return;
  try {
    if (registrationToken) {
      sessionStorage.setItem(REGISTRATION_TOKEN_KEY, String(registrationToken));
    }
    if (profile) {
      sessionStorage.setItem(REGISTRATION_PROFILE_KEY, JSON.stringify(profile));
    }
  } catch {
    // ignore
  }
}

export function getRegistrationToken() {
  if (typeof window === 'undefined') return '';
  try {
    return sessionStorage.getItem(REGISTRATION_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function getRegistrationProfile() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(REGISTRATION_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearRegistrationSession() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(REGISTRATION_TOKEN_KEY);
    sessionStorage.removeItem(REGISTRATION_PROFILE_KEY);
  } catch {
    // ignore
  }
}

export function buildCheckoutPath({ planCode, discountCode, planId } = {}) {
  const params = new URLSearchParams();
  if (planCode) params.set('plan', planCode);
  if (planId) params.set('planId', planId);
  if (discountCode) params.set('discount', discountCode);
  const qs = params.toString();
  return qs ? `/checkout?${qs}` : '/checkout';
}
