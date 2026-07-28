import toast from 'react-hot-toast';

/** Welcome toast for admin login — shows plan name + days remaining when available. */
export function toastAdminWelcome(user) {
  const sub = user?.subscription || user?.tenant?.subscription;
  if (!sub?.planName) {
    toast.success('Welcome back', { id: 'admin-welcome' });
    return;
  }
  const days = sub.daysRemaining;
  let message;
  if (days == null) {
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
  toast.success(message, { id: 'admin-plan-remaining', duration: 5500 });
}
