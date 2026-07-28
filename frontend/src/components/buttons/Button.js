'use client';

import { cn } from '@/utils';

export function Button({
  children,
  variant = 'primary',
  className,
  type = 'button',
  loading = false,
  disabled,
  ...props
}) {
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
  };

  return (
    <button
      type={type}
      className={cn(variants[variant] || variants.primary, 'w-full sm:w-auto', className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? 'Please wait...' : children}
    </button>
  );
}
