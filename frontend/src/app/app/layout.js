'use client';

import { usePathname } from 'next/navigation';
import { CustomerAppLayout } from '@/features/customer/CustomerAppLayout';

export default function AppShellLayout({ children }) {
  const pathname = usePathname() || '';
  const hideNav = pathname.includes('/scan');

  return <CustomerAppLayout hideNav={hideNav}>{children}</CustomerAppLayout>;
}
