'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Seats live on the Outlets dashboard — keep a stable nav target. */
export default function AdminMyOutletSeatsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/outlets');
  }, [router]);
  return null;
}
