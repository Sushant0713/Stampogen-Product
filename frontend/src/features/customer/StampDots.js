export function StampRowLarge({ dots = [] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {dots.map((s, i) =>
        s.filled ? (
          <div
            key={i}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[radial-gradient(circle_at_32%_28%,#8fb4ff,#3B82F6_55%,#1a4fc4_100%)] shadow-[0_4px_10px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.5)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 12l5 5L20 6"
                stroke="#fff"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        ) : (
          <div
            key={i}
            className="h-11 w-11 rounded-full border-[1.5px] border-dashed border-white/35"
          />
        )
      )}
    </div>
  );
}

export function StampRowSmall({ dots = [] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {dots.map((s, i) =>
        s.filled ? (
          <div
            key={i}
            className="h-4 w-4 rounded-full bg-[radial-gradient(circle_at_32%_28%,#8fb4ff,#3B82F6_60%,#1a4fc4_100%)]"
          />
        ) : (
          <div key={i} className="h-4 w-4 rounded-full border border-[#E2E8F0] bg-[#F1F5F9]" />
        )
      )}
    </div>
  );
}
