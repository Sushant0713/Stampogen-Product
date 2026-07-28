'use client';

/**
 * Auth layout for admin / affiliate / super-admin portals.
 * Full-viewport navy background; form scrolls inside the white card only.
 * Children render once (shared desktop/mobile) to avoid duplicate IDs / hydration noise.
 */
export function AdminAuthShell({ children }) {
  return (
    <div className="min-h-[100dvh] bg-[#021A54] lg:h-[100dvh]">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1600px] flex-col lg:grid lg:h-[100dvh] lg:grid-cols-[minmax(260px,30%)_minmax(0,1fr)]">
        <aside className="relative flex min-h-[200px] w-full shrink-0 bg-[#021A54] lg:min-h-0">
          <img
            src="/stampogen-full-logo-white.png?v=4"
            alt="Stampogen"
            className="absolute left-1/2 top-1/2 h-auto w-[min(78%,280px)] max-w-[280px] -translate-x-1/2 -translate-y-1/2 object-contain lg:w-[min(72%,320px)] lg:max-w-[320px]"
          />
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 lg:p-4 lg:pl-1">
          <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto overscroll-contain rounded-t-[28px] bg-white px-5 pb-6 pt-6 shadow-[0_-8px_40px_rgba(2,26,84,0.12)] sm:px-8 lg:rounded-[24px] lg:px-10 lg:py-6 lg:shadow-[0_20px_60px_rgba(2,26,84,0.18)]">
            <div className="mx-auto w-full max-w-[680px] py-2 lg:my-auto">{children}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
