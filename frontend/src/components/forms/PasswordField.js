'use client';

import { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

/**
 * Portal-styled password input with left lock icon and show/hide toggle.
 */
export function PasswordField({
  id,
  label,
  error,
  hint,
  className = '',
  inputClassName = '',
  showLockIcon = true,
  ...props
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className={`w-full ${className}`}>
      {label ? (
        <label htmlFor={id} className="mb-1.5 block text-[16px] font-semibold text-[#101828]">
          {label}
        </label>
      ) : null}
      <div className="relative">
        {showLockIcon ? (
          <Lock
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#98A2B3]"
          />
        ) : null}
        <input
          id={id}
          {...props}
          type={showPassword ? 'text' : 'password'}
          suppressHydrationWarning
          className={`h-[52px] w-full rounded-[10px] border bg-white text-[17px] text-[#101828] outline-none transition placeholder:text-[#98A2B3] focus:border-[#021A54] focus:ring-1 focus:ring-[#021A54] ${
            showLockIcon ? 'pl-12' : 'px-4'
          } pr-12 ${error ? 'border-red-500' : 'border-[#D0D5DD]'} ${inputClassName}`}
        />
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          suppressHydrationWarning
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#98A2B3] transition hover:text-[#021A54]"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
      {hint && !error ? <p className="mt-1 text-[14px] text-[#98A2B3]">{hint}</p> : null}
      {error ? <p className="mt-1 text-sm text-red-500">{error}</p> : null}
    </div>
  );
}
