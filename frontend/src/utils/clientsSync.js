const CHANNEL_NAME = 'stampogen-clients';
const STORAGE_KEY = 'stampogen-clients-invalidate';

/** Notify Super Admin client list that a shop/payment changed. */
export function notifyClientsChanged() {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage({ type: 'clients-changed', at: Date.now() });
      channel.close();
    }
  } catch {
    // ignore
  }

  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

/** Subscribe to client list invalidation (same browser / other tabs). */
export function subscribeClientsChanged(onChange) {
  let channel;

  const handleStorage = (event) => {
    if (event.key === STORAGE_KEY) onChange();
  };

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = () => onChange();
    }
  } catch {
    channel = null;
  }

  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener('storage', handleStorage);
    try {
      channel?.close();
    } catch {
      // ignore
    }
  };
}
