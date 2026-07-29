'use client';

import { Toaster } from 'react-hot-toast';

export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      containerStyle={{
        top: 16,
        zIndex: 9999,
      }}
      toastOptions={{
        duration: 4000,
        style: {
          border: '1px solid #E5E7EB',
          borderRadius: '8px',
          fontSize: '14px',
          padding: '10px 12px',
          maxWidth: '420px',
        },
      }}
    />
  );
}
