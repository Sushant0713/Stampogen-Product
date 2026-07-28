'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/utils';
import { APP_NAME } from '@/constants';
import { SIDEBAR_CONFIG } from '@/constants/sidebar';

function NavLink({ item, collapsed, pathname }) {
  const Icon = item.icon;
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

  if (item.disabled) {
    return (
      <div
        className={cn(
          'flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground opacity-60',
          collapsed && 'justify-center px-2'
        )}
        title={collapsed ? item.label : undefined}
      >
        {Icon && <Icon size={18} />}
        {!collapsed && <span>{item.label}</span>}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      prefetch={false}
      title={collapsed ? item.label : undefined}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
        collapsed && 'justify-center px-2',
        isActive ? 'bg-primary text-white' : 'text-foreground hover:bg-muted hover:text-primary'
      )}
    >
      {Icon && <Icon size={18} />}
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

function NavGroup({ item, collapsed, pathname }) {
  const Icon = item.icon;
  const childActive = item.children?.some(
    (child) => pathname === child.href || pathname.startsWith(`${child.href}/`)
  );
  const [open, setOpen] = useState(childActive);

  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  if (collapsed) {
    return (
      <div className="space-y-1">
        <div
          className={cn(
            'flex justify-center rounded-md px-2 py-2.5',
            childActive ? 'bg-primary text-white' : 'text-foreground'
          )}
          title={item.label}
        >
          {Icon && <Icon size={18} />}
        </div>
        {item.children?.map((child) => (
          <NavLink key={child.href} item={child} collapsed pathname={pathname} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
          childActive
            ? 'bg-muted text-primary'
            : 'text-foreground hover:bg-muted hover:text-primary'
        )}
      >
        {Icon && <Icon size={18} />}
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown
          size={16}
          className={cn('transition-transform', open ? 'rotate-180' : 'rotate-0')}
        />
      </button>

      {open && (
        <div className="mt-1 space-y-1 border-l border-border ml-4 pl-2">
          {item.children.map((child) => (
            <NavLink key={child.href} item={child} collapsed={false} pathname={pathname} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ role, collapsed, onToggle }) {
  const pathname = usePathname();
  const config = SIDEBAR_CONFIG[role];

  if (!config) return null;

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-white shadow-sidebar transition-all duration-200',
        collapsed ? 'w-sidebar-collapsed' : 'w-sidebar'
      )}
    >
      <div className="flex h-navbar items-center justify-between border-b border-border px-4">
        {!collapsed && (
          <div>
            <p className="font-display text-lg font-semibold text-primary">{APP_NAME}</p>
            <p className="text-xs text-muted-foreground">{config.title}</p>
          </div>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="rounded-md p-2 text-primary hover:bg-muted"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {config.items.map((item) =>
          item.children?.length ? (
            <NavGroup key={item.label} item={item} collapsed={collapsed} pathname={pathname} />
          ) : (
            <NavLink
              key={item.label}
              item={item}
              collapsed={collapsed}
              pathname={pathname}
            />
          )
        )}
      </nav>
    </aside>
  );
}
