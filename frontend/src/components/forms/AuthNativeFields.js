'use client';

/**
 * Native form controls with suppressHydrationWarning.
 * Browser extensions often inject attributes (e.g. fdprocessedid) before
 * React hydrates, which otherwise floods the console with mismatches.
 */
export function AuthInput(props) {
  return <input suppressHydrationWarning {...props} />;
}

export function AuthSelect(props) {
  return <select suppressHydrationWarning {...props} />;
}

export function AuthButton(props) {
  return <button suppressHydrationWarning {...props} />;
}

export function AuthTextarea(props) {
  return <textarea suppressHydrationWarning {...props} />;
}
