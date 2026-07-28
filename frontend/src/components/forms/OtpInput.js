'use client';

import { useEffect, useRef } from 'react';

export function OtpInput({ value, onChange, length = 6, disabled = false, error }) {
  const inputsRef = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  const updateValue = (nextDigits) => {
    onChange(nextDigits.join('').slice(0, length));
  };

  const handleChange = (index, raw) => {
    const cleaned = raw.replace(/\D/g, '');
    if (!cleaned) {
      const next = [...digits];
      next[index] = '';
      updateValue(next);
      return;
    }

    const chars = cleaned.split('');
    const next = [...digits];
    let cursor = index;

    chars.forEach((char) => {
      if (cursor < length) {
        next[cursor] = char;
        cursor += 1;
      }
    });

    updateValue(next);

    if (cursor < length) {
      inputsRef.current[cursor]?.focus();
    } else {
      inputsRef.current[length - 1]?.blur();
    }
  };

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowRight' && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;

    const next = Array.from({ length }, (_, i) => pasted[i] || '');
    updateValue(next);

    const focusIndex = Math.min(pasted.length, length - 1);
    inputsRef.current[focusIndex]?.focus();
  };

  return (
    <div>
      <div className="flex justify-between gap-2 sm:gap-3">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputsRef.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={1}
            value={digit}
            disabled={disabled}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            className={`h-12 w-11 rounded-md border text-center font-display text-lg font-semibold text-primary outline-none transition-colors sm:h-14 sm:w-12 ${
              error
                ? 'border-danger focus:border-danger focus:ring-1 focus:ring-danger'
                : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
            } disabled:bg-muted`}
            aria-label={`Digit ${index + 1}`}
          />
        ))}
      </div>
      {error && <p className="form-error mt-2 text-center">{error}</p>}
    </div>
  );
}
