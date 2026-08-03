'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/utils';
import { APP_NAME, ROLES } from '@/constants';
import { SIDEBAR_CONFIG, getSidebarItemsForUser } from '@/constants/sidebar';
import { userService } from '@/services/user.service';
import { useAuth } from '@/contexts/AuthContext';

function formatBadgeCount(count) {
  const n = Number(count) || 0;
  if (n <= 0) return null;
  return n > 99 ? '99+' : String(n);
}

function Badge({ count, active = false }) {
  const label = formatBadgeCount(count);
  if (!label) return null;
  return (
    <span
      className={cn(
        'ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
        active ? 'bg-white text-primary' : 'bg-[#D92D20] text-white'
      )}
    >
      {label}
    </span>
  );
}

function NavLink({ item, collapsed, pathname, badgeCount = 0, siblingHrefs = [] }) {
  const Icon = item.icon;
  const exact = pathname === item.href;
  const prefixMatch = pathname.startsWith(`${item.href}/`);
  const stolenByLongerSibling =
    prefixMatch &&
    siblingHrefs.some(
      (href) =>
        href !== item.href &&
        href.startsWith(`${item.href}/`) &&
        (pathname === href || pathname.startsWith(`${href}/`))
    );
  const isActive =
    item.match === 'exact'
      ? exact
      : exact || (prefixMatch && !stolenByLongerSibling);
  const badge = formatBadgeCount(badgeCount);

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
      data-tour={item.tourId || undefined}
      title={collapsed ? `${item.label}${badge ? ` (${badge})` : ''}` : undefined}
      className={cn(
        'relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
        collapsed && 'justify-center px-2',
        isActive ? 'bg-primary text-white' : 'text-foreground hover:bg-muted hover:text-primary'
      )}
    >
      {Icon && <Icon size={18} />}
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {!collapsed ? <Badge count={badgeCount} active={isActive} /> : null}
      {collapsed && badge ? (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#D92D20]" />
      ) : null}
    </Link>
  );
}

function NavGroup({ item, collapsed, pathname, badges = {} }) {
  const Icon = item.icon;
  const childActive = item.children?.some((child) => {
    if (pathname === child.href) return true;
    if (child.match === 'exact') return false;
    return pathname.startsWith(`${child.href}/`);
  });
  const [open, setOpen] = useState(childActive);
  const groupBadgeCount = (item.children || []).reduce((sum, child) => {
    if (!child.badgeKey) return sum;
    return sum + (Number(badges[child.badgeKey]) || 0);
  }, 0);

  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  if (collapsed) {
    return (
      <div className="space-y-1">
        <div
          className={cn(
            'relative flex justify-center rounded-md px-2 py-2.5',
            childActive ? 'bg-primary text-white' : 'text-foreground'
          )}
          title={`${item.label}${groupBadgeCount ? ` (${formatBadgeCount(groupBadgeCount)})` : ''}`}
        >
          {Icon && <Icon size={18} />}
          {groupBadgeCount > 0 ? (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#D92D20]" />
          ) : null}
        </div>
        {item.children?.map((child) => (
          <NavLink
            key={child.href}
            item={child}
            collapsed
            pathname={pathname}
            badgeCount={child.badgeKey ? badges[child.badgeKey] : 0}
            siblingHrefs={(item.children || []).map((row) => row.href)}
          />
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
        <Badge count={groupBadgeCount} />
        <ChevronDown
          size={16}
          className={cn('shrink-0 transition-transform', open ? 'rotate-180' : 'rotate-0')}
        />
      </button>

      {open && (
        <div className="mt-1 ml-4 space-y-1 border-l border-border pl-2">
          {item.children.map((child) => (
            <NavLink
              key={child.href}
              item={child}
              collapsed={false}
              pathname={pathname}
              badgeCount={child.badgeKey ? badges[child.badgeKey] : 0}
              siblingHrefs={(item.children || []).map((row) => row.href)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ role, collapsed, onToggle }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const config = SIDEBAR_CONFIG[role];
  const items = getSidebarItemsForUser(role, user);
  const [badges, setBadges] = useState({});

  const loadBadges = useCallback(async () => {
    if (role !== ROLES.SUPER_ADMIN) {
      setBadges({});
      return;
    }
    try {
      const { data } = await userService.getAffiliateStats();
      const stats = data?.data?.stats || {};
      setBadges({
        pendingApprovals: Number(stats.pendingApprovals) || 0,
        pendingRedeems: Number(stats.pendingRedeems) || 0,
      });
    } catch {
      // Keep previous badges on soft failure
    }
  }, [role]);

  useEffect(() => {
    loadBadges();
  }, [loadBadges, pathname]);

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
            <p className="text-xs text-muted-foreground">
              {user?.isOutlet || user?.tenant?.kind === 'outlet' ? 'Outlet' : config.title}
            </p>
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
        {items.map((item) => {
          const siblingHrefs = items.filter((row) => row.href).map((row) => row.href);

          if (item.children?.length) {
            return (
              <NavGroup
                key={item.label}
                item={item}
                collapsed={collapsed}
                pathname={pathname}
                badges={badges}
              />
            );
          }

          return (
            <NavLink
              key={item.label}
              item={item}
              collapsed={collapsed}
              pathname={pathname}
              badgeCount={item.badgeKey ? badges[item.badgeKey] : 0}
              siblingHrefs={siblingHrefs}
            />
          );
        })}
      </nav>
    </aside>
  );
}
