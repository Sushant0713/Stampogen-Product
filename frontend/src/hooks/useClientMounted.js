'use client';

import { useEffect, useState } from 'react';

/**
 * True only after the component has mounted in the browser.
 * Use to defer form controls so browser extensions (fdprocessedid, etc.)
 * cannot cause React hydration mismatches.
 */
export function useClientMounted() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}
