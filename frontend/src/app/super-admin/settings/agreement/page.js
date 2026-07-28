'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageLoader } from '@/components/loaders/Spinner';

/** Legacy path — redirect to Terms and conditions */
export default function SuperAdminAgreementSettingsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/super-admin/settings/terms');
  }, [router]);
  return <PageLoader />;
}
