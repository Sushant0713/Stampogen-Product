'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/utils';

const NAV = [
  {
    id: 'shops',
    label: 'My Cards',
    href: '/app',
    mobileLabel: 'Shops',
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 10l1.5-6h15L21 10"
          stroke={active ? '#fff' : '#64748B'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4 10v9a1 1 0 001 1h14a1 1 0 001-1v-9"
          stroke={active ? '#fff' : '#64748B'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9 20v-5a1 1 0 011-1h4a1 1 0 011 1v5"
          stroke={active ? '#fff' : '#64748B'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: 'rewards',
    label: 'Rewards',
    href: '/app/rewards',
    mobileLabel: 'Rewards',
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 2l2.9 6.3 6.8.8-5 4.8 1.3 6.7L12 17.3 5.9 20.6l1.3-6.7-5-4.8 6.8-.8L12 2z"
          stroke={active ? '#fff' : '#64748B'}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

function isActive(pathname, href) {
  if (href === '/app') return pathname === '/app' || pathname.startsWith('/app/cards');
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function CustomerSidebar() {
  const pathname = usePathname() || '';

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[240px] flex-col border-r border-[#E2E8F0] bg-white lg:flex">
      <div className="border-b border-[#E2E8F0] px-6 py-5">
        <Link href="/app" className="text-lg font-extrabold tracking-tight text-[#021A54]">
          Stampogen
        </Link>
        <p className="mt-1 text-xs font-medium text-[#64748B]">Loyalty Cards</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-4">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition',
                active ? 'bg-[#021A54] text-white' : 'text-[#64748B] hover:bg-[#F1F5F9]'
              )}
            >
              {item.icon(active)}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function CustomerBottomNav() {
  const pathname = usePathname() || '';

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 lg:hidden">
      <div className="flex gap-1 rounded-[100px] border border-white/60 bg-white/75 p-1.5 shadow-[0_12px_30px_rgba(2,26,84,0.18)] backdrop-blur-xl">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                'flex items-center gap-2 rounded-[100px] px-5 py-2.5 text-[13px] font-bold transition',
                active ? 'bg-[#021A54] text-white' : 'text-[#64748B]'
              )}
            >
              {item.icon(active)}
              {item.mobileLabel}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
