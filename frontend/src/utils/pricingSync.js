const CHANNEL_NAME = 'stampogen-pricing';
const STORAGE_KEY = 'stampogen-pricing-invalidate';

/** Notify open /pricing tabs that public plans changed. */
export function notifyPricingPlansChanged() {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage({ type: 'plans-changed', at: Date.now() });
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

/** Subscribe to plan visibility/content changes for the pricing page. */
export function subscribePricingPlansChanged(onChange) {
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
