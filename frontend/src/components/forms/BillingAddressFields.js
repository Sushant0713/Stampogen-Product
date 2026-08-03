'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { SearchableSelect } from '@/components/forms/SearchableSelect';

const inputClass =
  'h-[52px] w-full rounded-[10px] border border-[#D0D5DD] bg-white px-4 text-[17px] text-[#101828] outline-none transition placeholder:text-[#98A2B3] focus:border-[#021A54] focus:ring-1 focus:ring-[#021A54]';

const INDIA = 'IN';

function normalizeStateName(name = '') {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Structured billing address:
 * street (top) → searchable state → searchable city → searchable PIN
 */
export function BillingAddressFields({
  idPrefix = '',
  values,
  errors = {},
  onChange,
}) {
  const street = values.street || '';
  const state = values.state || '';
  const stateCode = values.stateCode || '';
  const city = values.city || '';
  const pin = values.pin || '';

  const [pinQuery, setPinQuery] = useState(pin || '');
  const [pinOpen, setPinOpen] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinResults, setPinResults] = useState([]);
  const [pinHint, setPinHint] = useState('');
  const [csc, setCsc] = useState(null);
  const [cscLoading, setCscLoading] = useState(true);

  // Lazy-load ~8MB dataset only when address fields mount — keeps register page snappy
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import('country-state-city');
        if (!cancelled) setCsc({ State: mod.State, City: mod.City });
      } catch {
        if (!cancelled) setCsc(null);
      } finally {
        if (!cancelled) setCscLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stateOptions = useMemo(() => {
    if (!csc?.State) return [];
    return csc.State.getStatesOfCountry(INDIA).map((item) => ({
      value: item.isoCode,
      label: item.name,
      name: item.name,
    }));
  }, [csc]);

  const cityOptions = useMemo(() => {
    if (!csc?.City || !stateCode) return [];
    const list = csc.City.getCitiesOfState(INDIA, stateCode).map((item) => ({
      value: item.name,
      label: item.name,
    }));
    if (city && !list.some((opt) => opt.value === city)) {
      list.unshift({ value: city, label: city });
    }
    return list;
  }, [csc, stateCode, city]);

  useEffect(() => {
    setPinQuery(pin || '');
  }, [pin]);

  // Registration saves state name without isoCode — resolve so city dropdown works and state shows selected.
  useEffect(() => {
    if (!csc || !state || stateCode) return;
    const matched = stateOptions.find(
      (opt) => normalizeStateName(opt.name) === normalizeStateName(state)
    );
    if (!matched) return;
    onChange({
      street,
      state: matched.name,
      stateCode: matched.value,
      city,
      pin,
    });
  }, [csc, state, stateCode, stateOptions, onChange, street, city, pin]);

  const patch = useCallback(
    (next) => {
      onChange({
        street,
        state,
        stateCode,
        city,
        pin,
        ...next,
      });
    },
    [onChange, street, state, stateCode, city, pin]
  );

  const applyPinOffice = useCallback(
    (office) => {
      const pinCode = String(office.Pincode || office.pincode || '').trim();
      const district = String(office.District || office.district || '').trim();
      const stateName = String(office.State || office.state || '').trim();
      const matchedState = stateOptions.find(
        (opt) => normalizeStateName(opt.name) === normalizeStateName(stateName)
      );

      patch({
        pin: pinCode,
        city: district || city,
        state: matchedState?.name || stateName || state,
        stateCode: matchedState?.value || stateCode,
      });
      setPinQuery(pinCode);
      setPinOpen(false);
      setPinResults([]);
      setPinHint(office.Name ? `Matched: ${office.Name}` : '');
    },
    [city, patch, state, stateCode, stateOptions]
  );

  useEffect(() => {
    const q = pinQuery.trim();
    if (q.length < 3) {
      setPinResults([]);
      setPinHint('');
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPinLoading(true);
      setPinHint('');
      try {
        const isPin = /^\d{6}$/.test(q);
        const url = isPin
          ? `https://api.postalpincode.in/pincode/${q}`
          : `https://api.postalpincode.in/postoffice/${encodeURIComponent(q)}`;

        const res = await fetch(url, { signal: controller.signal });
        const data = await res.json();
        const block = Array.isArray(data) ? data[0] : null;
        const offices = Array.isArray(block?.PostOffice) ? block.PostOffice : [];

        if (!offices.length) {
          setPinResults([]);
          setPinHint(isPin ? 'No post office found for this PIN' : 'No matching PIN / area');
          return;
        }

        const seen = new Set();
        const unique = [];
        for (const office of offices) {
          const key = `${office.Pincode}|${office.District}|${office.Name}`;
          if (seen.has(key)) continue;
          seen.add(key);
          unique.push(office);
          if (unique.length >= 25) break;
        }
        setPinResults(unique);

        // Only auto-fill empty city/state — never overwrite registration prefill on open.
        if (isPin && unique[0] && (!city || !state || !stateCode)) {
          const office = unique[0];
          const pinCode = String(office.Pincode || q).trim();
          const district = String(office.District || '').trim();
          const stateName = String(office.State || '').trim();
          const matchedState = stateOptions.find(
            (opt) => normalizeStateName(opt.name) === normalizeStateName(stateName)
          );
          patch({
            pin: pinCode,
            city: city || district,
            state: state || matchedState?.name || stateName,
            stateCode: stateCode || matchedState?.value || '',
          });
          setPinQuery(pinCode);
          setPinHint(`Found ${unique.length} area${unique.length > 1 ? 's' : ''} for PIN ${pinCode}`);
        }
      } catch (error) {
        if (error?.name === 'AbortError') return;
        setPinResults([]);
        setPinHint('Unable to search PIN right now');
      } finally {
        setPinLoading(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
    // Only re-search when the query changes — avoid loops from state/city fills
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinQuery]);

  return (
    <div className="space-y-2">
      <div>
        <label
          htmlFor={`${idPrefix}street`}
          className="mb-1.5 block text-[16px] font-semibold text-[#101828]"
        >
          Street address
        </label>
        <input
          id={`${idPrefix}street`}
          type="text"
          placeholder="Building, street, landmark"
          value={street}
          onChange={(event) => patch({ street: event.target.value })}
          className={`${inputClass} ${errors.street ? 'border-red-500' : ''}`}
        />
        {errors.street ? (
          <p className="mt-1 text-xs text-red-500">{errors.street.message}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <SearchableSelect
          id={`${idPrefix}state`}
          label="State"
          value={stateCode || state}
          options={stateOptions}
          placeholder={cscLoading ? 'Loading states…' : 'Select state'}
          searchPlaceholder="Search state…"
          disabled={cscLoading || !csc}
          emptyMessage={cscLoading ? 'Loading…' : 'No states found'}
          error={errors.state?.message || ''}
          onChange={(opt) =>
            patch({
              state: opt.name || opt.label,
              stateCode: opt.value,
              city: '',
            })
          }
        />

        <SearchableSelect
          id={`${idPrefix}city`}
          label="City"
          value={city}
          options={cityOptions}
          placeholder={
            cscLoading ? 'Loading cities…' : stateCode ? 'Select city' : 'Select state first'
          }
          searchPlaceholder="Search city…"
          disabled={cscLoading || !csc || !stateCode}
          emptyMessage={
            cscLoading ? 'Loading…' : stateCode ? 'No cities found' : 'Select a state first'
          }
          error={errors.city?.message || ''}
          onChange={(opt) => patch({ city: opt.value })}
        />
      </div>

      <div className="relative">
        <label
          htmlFor={`${idPrefix}pin`}
          className="mb-1.5 block text-[16px] font-semibold text-[#101828]"
        >
          PIN code
        </label>
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#98A2B3]"
          />
          <input
            id={`${idPrefix}pin`}
            type="text"
            inputMode="search"
            autoComplete="postal-code"
            placeholder="Search PIN or area name"
            value={pinQuery}
            onFocus={() => setPinOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setPinOpen(false), 150);
            }}
            onChange={(event) => {
              const next = event.target.value.replace(/[^\dA-Za-z\s]/g, '').slice(0, 40);
              setPinQuery(next);
              setPinOpen(true);
              if (/^\d{0,6}$/.test(next)) {
                patch({ pin: next });
              }
            }}
            className={`${inputClass} pl-10 pr-10 ${errors.pin ? 'border-red-500' : ''}`}
          />
          {pinLoading ? (
            <Loader2
              size={16}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-[#021A54]"
            />
          ) : null}
        </div>
        {errors.pin ? <p className="mt-1 text-xs text-red-500">{errors.pin.message}</p> : null}
        {pinHint && !errors.pin ? (
          <p className="mt-1.5 text-[12px] text-[#667085]">{pinHint}</p>
        ) : null}

        {pinOpen && pinResults.length > 0 ? (
          <ul className="absolute z-30 mt-1.5 max-h-52 w-full overflow-y-auto rounded-[10px] border border-[#E4E7EC] bg-white py-1 shadow-[0_8px_24px_rgba(16,24,40,0.12)]">
            {pinResults.map((office) => (
              <li key={`${office.Pincode}-${office.Name}-${office.District}`}>
                <button
                  type="button"
                  className="flex w-full flex-col px-3 py-2 text-left transition hover:bg-[#F5F8FF]"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyPinOffice(office)}
                >
                  <span className="text-[13px] font-semibold text-[#101828]">
                    {office.Pincode} · {office.Name}
                  </span>
                  <span className="text-[12px] text-[#667085]">
                    {[office.District, office.State].filter(Boolean).join(', ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

export function composeBillingAddress({ street, city, state, pin }) {
  return [street, [city, state].filter(Boolean).join(', '), pin ? `PIN ${pin}` : '']
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join('\n');
}
