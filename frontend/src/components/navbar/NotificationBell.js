'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { notificationService } from '@/services/notification.service';
import { getErrorMessage } from '@/utils';
import { ROLES } from '@/constants';

const CACHE_TTL_MS = 30000;
let notificationsCache = {
  items: [],
  unreadCount: 0,
  fetchedAt: 0,
};

function formatRelative(value) {
  if (!value) return '';
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function NotificationBell({ role }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(notificationsCache.items);
  const [unreadCount, setUnreadCount] = useState(notificationsCache.unreadCount);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  const loadUnreadOnly = useCallback(async () => {
    if (role !== ROLES.SUPER_ADMIN && role !== ROLES.ADMIN && role !== ROLES.USER) return;
    try {
      const countRes = await notificationService.unreadCount();
      const next = countRes.data?.data?.unreadCount || 0;
      setUnreadCount(next);
      notificationsCache = { ...notificationsCache, unreadCount: next };
    } catch {
      // Silent — navbar should not spam errors on poll
    }
  }, [role]);

  const loadList = useCallback(async ({ force = false } = {}) => {
    if (role !== ROLES.SUPER_ADMIN && role !== ROLES.ADMIN && role !== ROLES.USER) return;
    const fresh = Date.now() - notificationsCache.fetchedAt < CACHE_TTL_MS;
    if (!force && fresh && notificationsCache.items.length >= 0 && notificationsCache.fetchedAt) {
      setItems(notificationsCache.items);
      setUnreadCount(notificationsCache.unreadCount);
      return;
    }
    try {
      const [listRes, countRes] = await Promise.all([
        notificationService.list({ page: 1, limit: 12 }),
        notificationService.unreadCount(),
      ]);
      const nextItems = listRes.data?.data?.notifications || [];
      const nextCount = countRes.data?.data?.unreadCount || 0;
      setItems(nextItems);
      setUnreadCount(nextCount);
      notificationsCache = {
        items: nextItems,
        unreadCount: nextCount,
        fetchedAt: Date.now(),
      };
    } catch {
      // Silent
    }
  }, [role]);

  useEffect(() => {
    if (role !== ROLES.SUPER_ADMIN && role !== ROLES.ADMIN && role !== ROLES.USER) return undefined;
    // Hydrate from cache immediately; only fetch unread badge on interval
    if (notificationsCache.fetchedAt) {
      setItems(notificationsCache.items);
      setUnreadCount(notificationsCache.unreadCount);
    } else {
      loadList();
    }
    const timer = setInterval(loadUnreadOnly, 60000);
    return () => clearInterval(timer);
  }, [loadList, loadUnreadOnly, role]);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (role !== ROLES.SUPER_ADMIN && role !== ROLES.ADMIN && role !== ROLES.USER) return null;

  const handleOpen = async () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      try {
        setLoading(true);
        await loadList({ force: true });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleItemClick = async (item) => {
    try {
      if (!item.readAt) {
        await notificationService.markRead(item._id);
        setUnreadCount((c) => Math.max(0, c - 1));
        setItems((rows) => {
          const next = rows.map((row) =>
            row._id === item._id ? { ...row, readAt: new Date().toISOString() } : row
          );
          notificationsCache = {
            ...notificationsCache,
            items: next,
            unreadCount: Math.max(0, notificationsCache.unreadCount - 1),
          };
          return next;
        });
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to update notification'));
    }
    setOpen(false);
    if (item.link) {
      router.push(item.link);
    }
  };

  const handleMarkAll = async () => {
    try {
      await notificationService.markAllRead();
      setUnreadCount(0);
      setItems((rows) => {
        const next = rows.map((row) => ({
          ...row,
          readAt: row.readAt || new Date().toISOString(),
        }));
        notificationsCache = { ...notificationsCache, items: next, unreadCount: 0 };
        return next;
      });
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to mark all as read'));
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={handleOpen}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground hover:bg-muted"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#021A54] px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[340px] overflow-hidden rounded-xl border border-[#ECEFF3] bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-[#F2F4F7] px-4 py-3">
            <p className="text-sm font-semibold text-[#101828]">Notifications</p>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-[12px] font-semibold text-[#021A54] hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[#667085]">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[#667085]">No notifications yet</p>
            ) : (
              items.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  className={`block w-full border-b border-[#F2F4F7] px-4 py-3 text-left transition hover:bg-[#F9FAFB] ${
                    item.readAt ? 'bg-white' : 'bg-[#F5F8FF]'
                  }`}
                >
                  <p className="text-[13px] font-semibold text-[#101828]">{item.title}</p>
                  <p className="mt-0.5 text-[12px] text-[#667085]">{item.message}</p>
                  <p className="mt-1 text-[11px] text-[#98A2B3]">
                    {formatRelative(item.createdAt)}
                  </p>
                </button>
              ))
            )}
          </div>
          <div className="border-t border-[#F2F4F7] px-4 py-2.5">
            {role === ROLES.SUPER_ADMIN ? (
              <Link
                href="/super-admin/affiliates/pending"
                prefetch={false}
                onClick={() => setOpen(false)}
                className="text-[12px] font-semibold text-[#021A54] hover:underline"
              >
                Open pending affiliates
              </Link>
            ) : role === ROLES.USER ? (
              <Link
                href="/app"
                prefetch={false}
                onClick={() => setOpen(false)}
                className="text-[12px] font-semibold text-[#021A54] hover:underline"
              >
                Open my cards
              </Link>
            ) : (
              <Link
                href="/admin/rewards"
                prefetch={false}
                onClick={() => setOpen(false)}
                className="text-[12px] font-semibold text-[#021A54] hover:underline"
              >
                Open rewards
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
