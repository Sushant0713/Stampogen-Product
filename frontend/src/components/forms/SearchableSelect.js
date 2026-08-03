'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

const triggerClass =
  'flex h-[52px] w-full items-center justify-between gap-2 rounded-[10px] border border-[#D0D5DD] bg-white px-4 text-left text-[17px] text-[#101828] outline-none transition focus:border-[#021A54] focus:ring-1 focus:ring-[#021A54] disabled:cursor-not-allowed disabled:bg-[#F9FAFB] disabled:text-[#98A2B3]';

/**
 * Searchable single-select dropdown.
 * options: [{ value, label }]
 */
export function SearchableSelect({
  id,
  label,
  value,
  options = [],
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  disabled = false,
  error = '',
  emptyMessage = 'No results',
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(() => {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    const found =
      options.find((opt) => String(opt.value) === raw) ||
      options.find((opt) => String(opt.label).toLowerCase() === raw.toLowerCase()) ||
      options.find((opt) => String(opt.name || '').toLowerCase() === raw.toLowerCase());
    if (found) return found;
    return { value: raw, label: raw };
  }, [options, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => String(opt.label).toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return undefined;

    const onDoc = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);

    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(timer);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      {label ? (
        <label htmlFor={id} className="mb-1.5 block text-[16px] font-semibold text-[#101828]">
          {label}
        </label>
      ) : null}

      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
          setQuery('');
        }}
        className={`${triggerClass} ${error ? 'border-red-500' : ''} ${
          !selected ? 'text-[#98A2B3]' : ''
        }`}
      >
        <span className="truncate">{selected?.label || placeholder}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-[#98A2B3] transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {error ? <p className="mt-1 text-xs text-red-500">{error}</p> : null}

      {open ? (
        <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-[10px] border border-[#E4E7EC] bg-white shadow-[0_8px_24px_rgba(16,24,40,0.12)]">
          <div className="relative border-b border-[#F2F4F7] p-2">
            <Search
              size={14}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#98A2B3]"
            />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 w-full rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] pl-8 pr-3 text-[13px] text-[#101828] outline-none placeholder:text-[#98A2B3] focus:border-[#021A54]"
            />
          </div>
          <ul id={listId} role="listbox" className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2.5 text-[13px] text-[#98A2B3]">{emptyMessage}</li>
            ) : (
              filtered.map((opt) => {
                const active = String(opt.value) === String(value);
                return (
                  <li key={String(opt.value)}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`flex w-full px-3 py-2 text-left text-[13px] transition hover:bg-[#F5F8FF] ${
                        active ? 'bg-[#EAF2FF] font-semibold text-[#021A54]' : 'text-[#344054]'
                      }`}
                      onClick={() => {
                        onChange(opt);
                        setOpen(false);
                        setQuery('');
                      }}
                    >
                      {opt.label}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
