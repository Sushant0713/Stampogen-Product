'use client';

export function Spinner({ className = 'h-8 w-8' }) {
  return (
    <div
      className={`animate-spin rounded-full border-2 border-primary border-t-transparent ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <Spinner />
    </div>
  );
}

/** Compact loader for content area (keeps sidebar visible; no full-screen flash). */
export function ContentLoader() {
  return (
    <div className="flex min-h-[240px] w-full items-center justify-center py-16">
      <Spinner className="h-7 w-7" />
    </div>
  );
}
