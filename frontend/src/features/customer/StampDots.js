function CheckIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12l5 5L20 6"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Connected stamp track for the premium loyalty card (white progress panel). */
export function StampProgressTrack({ stamps = 0, stampsRequired = 5, size = 'md' }) {
  const required = Math.max(1, stampsRequired || 5);
  const filled = Math.min(stamps || 0, required);
  const isSm = size === 'sm';
  const circle = isSm ? 'h-6 w-6' : 'h-8 w-8 sm:h-9 sm:w-9';
  const checkSize = isSm ? 11 : 13;

  return (
    <div className="flex min-w-0 flex-1 items-center">
      {Array.from({ length: required }, (_, i) => {
        const done = i < filled;
        return (
          <div key={i} className="flex min-w-0 flex-1 items-center last:flex-none">
            <div
              className={`${circle} flex shrink-0 items-center justify-center rounded-full ${
                done ? 'bg-[#021A54]' : 'border-2 border-slate-300 bg-white'
              }`}
            >
              {done ? <CheckIcon size={checkSize} /> : null}
            </div>
            {i < required - 1 ? (
              <div
                className={`mx-0.5 h-0.5 min-w-[4px] flex-1 ${
                  i < filled - 1 ? 'bg-[#021A54]' : 'bg-slate-200'
                }`}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function StampRowLarge({ dots = [] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {dots.map((s, i) =>
        s.filled ? (
          <div
            key={i}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[radial-gradient(circle_at_32%_28%,#8fb4ff,#3B82F6_55%,#1a4fc4_100%)] shadow-[0_4px_10px_rgba(0,0,0,0.3),inset_0_1px_2px_rgba(255,255,255,0.5)]"
          >
            <CheckIcon size={18} />
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
