'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bike,
  CheckCircle2,
  Clock,
  Headset,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  MessagesSquare,
  X,
  type LucideIcon,
} from 'lucide-react';
import UserNotificationBell from '@/components/UserNotificationBell';
import { useAuth } from '@/lib/auth-context';
import type { RiderChatSummary } from '@/lib/rider-chat-types';

export type RiderProfile = { name: string; isApproved: boolean; isAvailable: boolean; vehicleType: string | null };

type RiderContextValue = {
  rider: RiderProfile;
  isOnline: boolean;
  hasLocation: boolean;
  error: string;
  toggleOnline: () => Promise<void>;
  requests: RiderChatSummary[];
  chats: RiderChatSummary[];
};

const RiderContext = createContext<RiderContextValue | null>(null);

export function useRider() {
  const context = useContext(RiderContext);
  if (!context) throw new Error('useRider must be used within RiderShell');
  return context;
}

/**
 * The rider's live state, kept above the pages so that moving around the sidebar never drops it: going online
 * (location sharing every 20 s) and polling the nearby requests / accepted chats every 5 s.
 */
function RiderProvider({ rider, children }: { rider: RiderProfile; children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(rider.isAvailable);
  const [hasLocation, setHasLocation] = useState(false);
  const [error, setError] = useState('');
  const [requests, setRequests] = useState<RiderChatSummary[]>([]);
  const [chats, setChats] = useState<RiderChatSummary[]>([]);
  const coords = useRef<{ lat: number; lng: number } | null>(null);

  const sendPresence = useCallback(async (available: boolean) => {
    try {
      await fetch('/api/rider/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: available, ...(coords.current ?? {}) }),
      });
    } catch {
      setError('Could not update your availability. Please try again.');
    }
  }, []);

  useEffect(() => {
    if (!isOnline || !rider.isApproved) return;
    if (!navigator.geolocation) {
      const timeout = window.setTimeout(() => setError('Location is not supported in this browser.'), 0);
      return () => window.clearTimeout(timeout);
    }
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        coords.current = { lat: position.coords.latitude, lng: position.coords.longitude };
        setHasLocation(true);
        setError('');
        void sendPresence(true);
      },
      () => setError('Please allow location access so customers can be matched to you.'),
      { enableHighAccuracy: true, maximumAge: 15000 }
    );
    const timer = window.setInterval(() => void sendPresence(true), 20000);
    return () => {
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(timer);
    };
  }, [isOnline, rider.isApproved, sendPresence]);

  useEffect(() => {
    if (!rider.isApproved) return;
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch('/api/rider/chats');
        if (!response.ok) return;
        const data = await response.json();
        if (active) {
          setRequests(data.requests ?? []);
          setChats(data.chats ?? []);
        }
      } catch {
        /* retry on the next poll */
      }
    };
    void poll();
    const timer = window.setInterval(poll, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [rider.isApproved]);

  const toggleOnline = useCallback(async () => {
    const next = !isOnline;
    setIsOnline(next);
    if (!next) {
      coords.current = null;
      setHasLocation(false);
    }
    await sendPresence(next);
  }, [isOnline, sendPresence]);

  const value = useMemo(
    () => ({ rider, isOnline, hasLocation, error, toggleOnline, requests, chats }),
    [rider, isOnline, hasLocation, error, toggleOnline, requests, chats]
  );

  return <RiderContext.Provider value={value}>{children}</RiderContext.Provider>;
}

const RIDER_PAGES = {
  home: '/rider',
  requests: '/rider/requests',
  chats: '/rider/chats',
  messages: '/rider/messages',
} as const;

const RIDER_LINKS: { href: string; label: string; icon: LucideIcon; needsApproval?: boolean }[] = [
  { href: RIDER_PAGES.home, label: 'Dashboard', icon: LayoutDashboard },
  { href: RIDER_PAGES.requests, label: 'New requests', icon: Inbox, needsApproval: true },
  { href: RIDER_PAGES.chats, label: 'Order chats', icon: MessagesSquare, needsApproval: true },
  { href: RIDER_PAGES.messages, label: 'Messages', icon: Headset },
];

function isActive(pathname: string, href: string) {
  return href === RIDER_PAGES.home ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const { rider, isOnline, requests } = useRider();

  const handleLogout = async () => {
    await logout();
    router.push('/');
    router.refresh();
  };

  return (
    <div className="flex h-full flex-col bg-brand-dark text-white">
      <div className="border-b border-white/10 p-4">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to website
        </Link>

        <div className="mt-4 flex items-center gap-2 px-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-red-primary to-brand-red-secondary">
            <Bike className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-bold leading-tight">{rider.name}</p>
            <p className="text-xs text-white/60">Rider dashboard{rider.vehicleType ? ` · ${rider.vehicleType}` : ''}</p>
          </div>
        </div>

        <div className="mt-3 ml-3 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              rider.isApproved ? 'bg-green-500/15 text-green-300' : 'bg-yellow-500/15 text-yellow-300'
            }`}
          >
            {rider.isApproved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
            {rider.isApproved ? 'Approved rider' : 'Pending approval'}
          </span>
          {rider.isApproved ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/70">
              <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-white/30'}`} />
              {isOnline ? 'Online' : 'Offline'}
            </span>
          ) : null}
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4" aria-label="Rider dashboard">
        {RIDER_LINKS.filter((link) => !(link.needsApproval && !rider.isApproved)).map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          const count = href === RIDER_PAGES.requests ? requests.length : 0;

          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                active ? 'bg-brand-red-primary text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 leading-snug">{label}</span>
              {count > 0 ? (
                <span
                  className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-bold text-brand-red-primary"
                  aria-label={`${count} new`}
                >
                  {count > 99 ? '99+' : count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="mb-2 flex items-center gap-2 px-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
            {rider.name.charAt(0).toUpperCase()}
          </span>
          <span className="truncate text-sm text-white/80">{rider.name}</span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();
  const currentLabel = RIDER_LINKS.find((link) => isActive(pathname, link.href))?.label ?? 'Rider dashboard';

  useEffect(() => {
    if (!isMobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileOpen]);

  return (
    <div className="flex min-h-screen flex-col bg-brand-light lg:flex-row">
      {/* Desktop: fixed-width sidebar that stays in view while the page scrolls */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile: top bar with a menu button that opens the same sidebar as a drawer */}
      <div className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-brand-dark px-4 py-3 text-white lg:hidden">
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="rounded-lg p-1.5 hover:bg-white/10"
          aria-label="Open rider menu"
        >
          <Menu className="h-6 w-6" />
        </button>
        <p className="flex-1 truncate font-semibold">{currentLabel}</p>
        <UserNotificationBell onDark />
      </div>

      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/60" onClick={() => setIsMobileOpen(false)} aria-label="Close rider menu" />
          <div className="relative h-full w-72 max-w-[85vw]">
            <SidebarContent onNavigate={() => setIsMobileOpen(false)} />
            <button
              type="button"
              onClick={() => setIsMobileOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-white/80 hover:bg-white/10"
              aria-label="Close rider menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        {/* Desktop: page title on the left, notifications on the right */}
        <header className="sticky top-0 z-30 hidden items-center justify-between gap-4 border-b border-gray-100 bg-surface px-8 py-3 lg:flex">
          <p className="text-sm font-semibold text-brand-gray">{currentLabel}</p>
          <UserNotificationBell />
        </header>
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
      </div>
    </div>
  );
}

/** The rider dashboard frame: left sidebar, notification bell and the page. Replaces the website's navbar there. */
export default function RiderShell({ rider, children }: { rider: RiderProfile; children: ReactNode }) {
  return (
    <RiderProvider rider={rider}>
      <Frame>{children}</Frame>
    </RiderProvider>
  );
}
