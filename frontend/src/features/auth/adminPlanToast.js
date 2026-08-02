import toast from 'react-hot-toast';

/** Welcome toast for admin login — shows plan name + days remaining when available. */
export function toastAdminWelcome(user) {
  const sub = user?.subscription || user?.tenant?.subscription;
  if (!sub?.planName) {
    toast.success('Welcome back', { id: 'admin-welcome' });
    return;
  }

  const days = sub.daysRemaining;
  const isTrial =
    sub.isTrial ||
    sub.source === 'trial' ||
    sub.status === 'trial_active' ||
    sub.status === 'trial_expiring_soon' ||
    sub.status === 'trial_expired';
  const trialExpired = sub.status === 'trial_expired' || (isTrial && days != null && days < 0);

  let message;
  if (trialExpired) {
    message = `Welcome back — your ${sub.planName} free trial ended ${Math.abs(days)} day${
      Math.abs(days) === 1 ? '' : 's'
    } ago. Upgrade anytime from My plan.`;
  } else if (isTrial && days == null) {
    message = `Welcome back — you're on a free trial of ${sub.planName}`;
  } else if (isTrial && days === 0) {
    message = `Welcome back — your ${sub.planName} free trial ends today`;
  } else if (isTrial) {
    message = `Welcome back — ${days} day${days === 1 ? '' : 's'} left on your ${sub.planName} free trial`;
  } else if (days == null) {
    message = `Welcome back — you're on ${sub.planName}`;
  } else if (days < 0) {
    message = `Welcome back — your ${sub.planName} plan expired ${Math.abs(days)} day${
      Math.abs(days) === 1 ? '' : 's'
    } ago`;
  } else if (days === 0) {
    message = `Welcome back — your ${sub.planName} plan expires today`;
  } else {
    message = `Welcome back — ${days} day${days === 1 ? '' : 's'} left on ${sub.planName}`;
  }

  const toastFn = trialExpired || (days != null && days < 0) ? toast.error : toast.success;
  toastFn(message, { id: 'admin-plan-remaining', duration: 5500 });
}
