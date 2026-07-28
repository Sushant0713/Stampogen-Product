'use client';

import toast, { Toaster, ToastBar } from 'react-hot-toast';
import { X } from 'lucide-react';

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
    >
      {(t) =>
        t.type === 'custom' ? (
          t.message
        ) : (
          <ToastBar toast={t} style={{ ...t.style, animation: undefined }}>
            {({ icon, message }) => (
              <div className="flex w-full items-start gap-3">
                {icon}
                <div className="min-w-0 flex-1">{message}</div>
                {t.type !== 'loading' && (
                  <button
                    type="button"
                    onClick={() => toast.dismiss(t.id)}
                    aria-label="Dismiss notification"
                    className="-mr-1 -mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#667085] transition hover:bg-[#F2F4F7] hover:text-[#101828]"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}
          </ToastBar>
        )
      }
    </Toaster>
  );
}
