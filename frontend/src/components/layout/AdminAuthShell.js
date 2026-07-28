'use client';

/**
 * Auth layout for admin / affiliate / super-admin portals.
 * Mobile: navy canvas + scrollable centered white card (works on short phones like SE).
 * Desktop: split view (white wordmark | form card).
 */
export function AdminAuthShell({ children }) {
  return (
    <div className="bg-[#021A54]">
      {/* —— Mobile / tablet: outer scroll so short viewports never clip the card —— */}
      <div className="max-h-[100dvh] overflow-x-hidden overflow-y-auto overscroll-y-contain lg:hidden">
        <div className="flex min-h-[100dvh] items-center justify-center px-3 py-5 sm:px-4 sm:py-8">
          <div className="w-full max-w-[400px] rounded-[24px] bg-white px-4 py-6 shadow-[0_20px_50px_rgba(0,0,0,0.28)] sm:rounded-[28px] sm:px-7 sm:py-8">
            <div className="mb-4 flex justify-center sm:mb-6">
              <img
                src="/logo.png"
                alt="Stampogen — Stamp. Reward. Repeat"
                className="h-auto max-h-[72px] w-auto max-w-[min(100%,240px)] object-contain sm:max-h-[88px] sm:max-w-[280px]"
              />
            </div>
            {children}
          </div>
        </div>
      </div>

      {/* —— Desktop —— */}
      <div className="mx-auto hidden h-[100dvh] w-full max-w-[1600px] grid-cols-[minmax(260px,30%)_minmax(0,1fr)] overflow-hidden lg:grid">
        <aside className="relative min-h-0 bg-[#021A54]">
          <img
            src="/stampogen-full-logo-white.png?v=4"
            alt="Stampogen"
            className="absolute left-1/2 top-1/2 h-auto w-[min(72%,320px)] max-w-[320px] -translate-x-1/2 -translate-y-1/2 object-contain"
          />
        </aside>

        <section className="flex min-h-0 min-w-0 p-4 pl-1">
          <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto overscroll-contain rounded-[24px] bg-white px-10 py-6 shadow-[0_20px_60px_rgba(2,26,84,0.18)]">
            <div className="mx-auto my-auto w-full max-w-[680px] py-2">{children}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
