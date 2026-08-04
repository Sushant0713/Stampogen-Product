'use client';

/**
 * HQ-only shop / outlet scope selector.
 * value '' = main shop (logged-in HQ tenant).
 */
export function AdminShopScopeSelect({
  outlets = [],
  value = '',
  onChange,
  disabled = false,
  className = '',
}) {
  if (!outlets.length) return null;

  return (
    <label className={`block ${className}`.trim()}>
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#94A3B8]">
        View shop
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        className="h-10 w-full max-w-xs rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm font-semibold text-[#021A54] outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 disabled:opacity-60"
      >
        <option value="">Main shop (default)</option>
        {outlets.map((outlet) => (
          <option key={outlet.id} value={outlet.id}>
            {outlet.name || 'Outlet'}
            {outlet.expired ? ' · plan ended' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}
