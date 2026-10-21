'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BadgeCheck,
  Bell,
  CheckCheck,
  ClipboardList,
  Heart,
  Megaphone,
  MessageSquare,
  ShoppingCart,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { NotificationKind, NotificationSnapshot, SellerNotification } from '@/lib/notification-types';

const POLL_INTERVAL_MS = 12000;
const TOAST_MS = 7000;
const MAX_TOASTS = 3;

type SeenRequest = { ids?: string[]; hrefs?: string[]; all?: boolean };

type NotificationsContextValue = {
  items: SellerNotification[];
  counts: Record<string, number>;
  total: number;
  markSeen: (request: SeenRequest) => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function useSellerNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useSellerNotifications must be used within SellerNotificationsProvider');
  return context;
}

const KIND_ICONS: Record<NotificationKind, LucideIcon> = {
  CART: ShoppingCart,
  ORDER: ClipboardList,
  MESSAGE: MessageSquare,
  LIKE: Heart,
  ACCOUNT: BadgeCheck,
  AD: Megaphone,
};

/** A notification counts as new when its id or its last update (repeat events refresh one entry) is unseen. */
const keyOf = (item: SellerNotification) => `${item.id}:${item.createdAt}`;

function timeAgo(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/**
 * Keeps the seller's unread notifications fresh (polling), pops a toast for each new one, and marks a
 * page's notifications as seen as soon as the seller opens that page. Seen notifications disappear
 * from here; whatever they were about stays in its own page.
 */
export function SellerNotificationsProvider({
  initial,
  endpoint = '/api/seller/notifications',
  children,
}: {
  initial: NotificationSnapshot;
  /** The API the bell polls; `<endpoint>/read` marks things seen. The admin panel uses `/api/admin/notifications`. */
  endpoint?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [snapshot, setSnapshot] = useState(initial);
  const [toasts, setToasts] = useState<SellerNotification[]>([]);
  const knownKeys = useRef(new Set(initial.items.map(keyOf)));
  const previousPath = useRef<string | null>(null);

  const apply = useCallback((next: NotificationSnapshot) => {
    const fresh = next.items.filter((item) => !knownKeys.current.has(keyOf(item)));
    fresh.forEach((item) => knownKeys.current.add(keyOf(item)));
    setSnapshot(next);
    if (fresh.length > 0) setToasts((current) => [...fresh, ...current].slice(0, MAX_TOASTS));
  }, []);

  /** Tells the server these are seen, then settles on its answer. */
  const postSeen = useCallback(
    (request: SeenRequest) => {
      fetch(`${endpoint}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: NotificationSnapshot | null) => {
          if (data) apply(data);
        })
        .catch(() => {
          // The next poll brings the real state back.
        });
    },
    [apply, endpoint]
  );

  const markSeen = useCallback(
    (request: SeenRequest) => {
      // Optimistic: they vanish immediately; the server's answer then settles the exact state.
      setSnapshot((current) => {
        const items = current.items.filter((item) => {
          if (request.all) return false;
          if (request.ids?.includes(item.id)) return false;
          return !(item.href && request.hrefs?.includes(item.href));
        });
        const counts = { ...current.counts };
        if (request.all) {
          for (const key of Object.keys(counts)) delete counts[key];
        } else {
          for (const href of request.hrefs ?? []) delete counts[href];
          for (const item of current.items) {
            if (request.ids?.includes(item.id) && item.href && counts[item.href]) {
              counts[item.href] -= 1;
              if (counts[item.href] <= 0) delete counts[item.href];
            }
          }
        }
        return { items, counts };
      });
      if (request.all || request.ids?.length) {
        setToasts((current) => current.filter((toast) => request.all || !request.ids?.includes(toast.id)));
      }

      postSeen(request);
    },
    [postSeen]
  );

  // Poll for new notifications while the tab is visible.
  useEffect(() => {
    const fetchLatest = async () => {
      if (document.visibilityState !== 'visible') return;

      try {
        const response = await fetch(endpoint, { cache: 'no-store' });
        if (response.ok) apply((await response.json()) as NotificationSnapshot);
      } catch {
        // Skip a failed poll; the next one retries.
      }
    };

    const intervalId = window.setInterval(fetchLatest, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', fetchLatest);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', fetchLatest);
    };
  }, [apply, endpoint]);

  // Opening a page marks its notifications as seen. If more arrive while the seller is already
  // looking at that page, refresh it so the new entries show up too.
  const unreadHere = snapshot.counts[pathname] ?? 0;

  useEffect(() => {
    const justNavigated = previousPath.current !== pathname;
    previousPath.current = pathname;

    if (unreadHere === 0) return;

    // The server's reply clears the badge; no local state is touched here.
    postSeen({ hrefs: [pathname] });
    if (!justNavigated) router.refresh();
  }, [pathname, unreadHere, postSeen, router]);

  // Whatever belongs to the page the seller is looking at counts as seen right away,
  // without waiting for the server to confirm it.
  const value = useMemo<NotificationsContextValue>(() => {
    const counts = { ...snapshot.counts };
    delete counts[pathname];

    return {
      items: snapshot.items.filter((item) => item.href !== pathname),
      counts,
      total: Object.values(counts).reduce((sum, count) => sum + count, 0),
      markSeen,
    };
  }, [snapshot, pathname, markSeen]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <NotificationToasts
        toasts={toasts}
        onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))}
        onOpen={(toast) => markSeen({ ids: [toast.id] })}
      />
    </NotificationsContext.Provider>
  );
}

function Toast({
  toast,
  onDismiss,
  onOpen,
}: {
  toast: SellerNotification;
  onDismiss: (id: string) => void;
  onOpen: (toast: SellerNotification) => void;
}) {
  const Icon = KIND_ICONS[toast.type];

  useEffect(() => {
    const timeoutId = window.setTimeout(() => onDismiss(toast.id), TOAST_MS);
    return () => window.clearTimeout(timeoutId);
  }, [toast.id, onDismiss]);

  const body = (
    <>
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-red-primary/10 text-accent">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{toast.title}</span>
        <span className="mt-0.5 line-clamp-2 text-xs text-brand-gray">{toast.message}</span>
      </span>
    </>
  );

  return (
    <div role="status" className="pointer-events-auto flex items-start gap-1 rounded-2xl border border-gray-100 bg-surface p-3 shadow-lg">
      {toast.href ? (
        <Link href={toast.href} onClick={() => onOpen(toast)} className="flex min-w-0 flex-1 items-start gap-3">
          {body}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-start gap-3">{body}</div>
      )}
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="rounded-full p-1 text-brand-gray hover:bg-brand-light hover:text-ink"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function NotificationToasts({
  toasts,
  onDismiss,
  onOpen,
}: {
  toasts: SellerNotification[];
  onDismiss: (id: string) => void;
  onOpen: (toast: SellerNotification) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <Toast key={keyOf(toast)} toast={toast} onDismiss={onDismiss} onOpen={onOpen} />
      ))}
    </div>
  );
}

/** Bell with an unread badge; opens the list of notifications the seller hasn't seen yet. */
export function NotificationBell({ onDark = false }: { onDark?: boolean }) {
  const { items, total, markSeen } = useSellerNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === 'Escape') setIsOpen(false);
      } else if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={total > 0 ? `Notifications, ${total} new` : 'Notifications'}
        className={`relative rounded-full border p-2.5 transition-colors ${
          onDark
            ? 'border-white/20 text-white hover:bg-white/10'
            : 'border-gray-200 text-ink hover:border-accent hover:text-accent'
        }`}
      >
        <Bell className="h-5 w-5" />
        {total > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-red-primary px-1 text-[10px] font-bold text-white">
            {total > 99 ? '99+' : total}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-4 top-16 z-40 overflow-hidden rounded-2xl border border-gray-100 bg-surface shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[22rem]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-bold text-ink">Notifications</p>
            {items.length > 0 ? (
              <button
                type="button"
                onClick={() => markSeen({ all: true })}
                className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all as seen
              </button>
            ) : null}
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-brand-gray">You&apos;re all caught up.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-gray-100 overflow-y-auto">
              {items.map((item) => {
                const Icon = KIND_ICONS[item.type];
                const content = (
                  <>
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-red-primary/10 text-accent">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{item.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-brand-gray">{item.message}</span>
                      <time dateTime={item.createdAt} suppressHydrationWarning className="mt-1 block text-[11px] text-brand-gray">
                        {timeAgo(item.createdAt)}
                      </time>
                    </span>
                  </>
                );

                return (
                  <li key={item.id}>
                    {item.href ? (
                      <Link
                        href={item.href}
                        onClick={() => {
                          markSeen({ ids: [item.id] });
                          setIsOpen(false);
                        }}
                        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-brand-light"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="flex items-start gap-3 px-4 py-3">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
