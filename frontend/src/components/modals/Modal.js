'use client';

export function Modal({ open, onClose, title, children }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close modal"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-lg border border-border bg-white p-6 shadow-card">
        {title && <h3 className="mb-4 text-lg font-semibold text-primary">{title}</h3>}
        {children}
      </div>
    </div>
  );
}
