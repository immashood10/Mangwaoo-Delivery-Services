'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bike,
  CheckCircle2,
  ClipboardList,
  Clock,
  Headset,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  MessagesSquare,
  Navigation,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import UserNotificationBell from '@/components/UserNotificationBell';
import { useAuth } from '@/lib/auth-context';
import { enableNotificationSound, playNotificationSound } from '@/lib/notification-sound';
import type { RiderChatSummary } from '@/lib/rider-chat-types';
import { RECHARGE_TITLE, type RiderHold } from '@/lib/rider-wallet-config';

export type RiderProfile = {
  name: string;
  isApproved: boolean;
  isAvailable: boolean;
  vehicleType: string | null;
  /** The face photo asked for at signup is on file (riders who signed up before it was required may lack it). */
  hasFacePhoto: boolean;
};

/** The rider's money standing: negative balance = owes Mangwaoo; `hold` = may not receive the next order. */
export type RiderWalletState = { balance: number; unpaidOrders: number; hold: RiderHold };
export type RiderRules = {
  commissionPercent: number;
  ordersOnCredit: number;
  /** Whether a completed order pays the rider a surprise delivery bonus (lib/rider-bonus.ts). */
  bonusEnabled: boolean;
};

export function holdMessage(hold: Exclude<RiderHold, null>) {
  return hold === 'PAYMENT'
    ? `${RECHARGE_TITLE} to go online and receive new orders.`
    : 'Mangwaoo has put your account on hold. Please contact support.';
}

type RiderContextValue = {
  rider: RiderProfile;
  wallet: RiderWalletState;
  rules: RiderRules;
  isOnline: boolean;
  hasLocation: boolean;
  error: string;
  toggleOnline: () => Promise<void>;
  requests: RiderChatSummary[];
  chats: RiderChatSummary[];
  /** The rider has an order in hand: their position goes to the customer who is following it (components/OrderTracker.tsx). */
  delivering: boolean;
  /** Takes a chat out of the lists at once (the rider just cancelled it, or it was cancelled under them). */
  dropChat: (chatId: string) => void;
};

const RiderContext = createContext<RiderContextValue | null>(null);

// The position is sent at most this often (a GPS watch can fire every second while moving): often enough for a smooth live map,
// rarely enough to spare the phone's battery and the database.
const POSITION_MIN_GAP_MS = 4000;

export function useRider() {
  const context = useContext(RiderContext);
  if (!context) throw new Error('useRider must be used within RiderShell');
  return context;
}

/**
 * The rider's live state, kept above the pages so that moving around the sidebar never drops it: going online
 * (location sharing every 20 s) and polling the nearby requests / accepted chats every 5 s.
 */
function RiderProvider({
  rider,
  initialWallet,
  rules,
  children,
}: {
  rider: RiderProfile;
  initialWallet: RiderWalletState;
  rules: RiderRules;
  children: ReactNode;
}) {
  const [wallet, setWallet] = useState(initialWallet);
  const [wantsOnline, setWantsOnline] = useState(rider.isAvailable);
  // A rider on hold can't be online, whatever the switch says.
  const isOnline = wantsOnline && !wallet.hold;
  const [hasLocation, setHasLocation] = useState(false);
  const [error, setError] = useState('');
  const [requests, setRequests] = useState<RiderChatSummary[]>([]);
  const [chats, setChats] = useState<RiderChatSummary[]>([]);
  const coords = useRef<{ lat: number; lng: number } | null>(null);
  const lastPresenceAt = useRef(0);
  // An order in hand: the rider's accepted chats (ACTIVE) are what the 5-second poll below brings.
  const delivering = chats.length > 0;
  // Chats cancelled here: a poll that was already on its way must not bring them back (ids are never reused).
  const droppedChats = useRef(new Set<string>());
  // What the previous poll saw, to tell what has just arrived (null until the first poll has answered).
  const knownRequestIds = useRef<Set<string> | null>(null);
  const knownChatStamps = useRef<Map<string, string> | null>(null);

  const sendPresence = useCallback(async (available: boolean) => {
    try {
      const response = await fetch('/api/rider/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: available, ...(coords.current ?? {}) }),
      });

      // Refused because of unpaid commission (or an admin's block): stay offline and say why.
      if (response.status === 403) {
        const data = await response.json().catch(() => null);

        if (data?.hold === 'PAYMENT' || data?.hold === 'ADMIN') {
          coords.current = null;
          setHasLocation(false);
          setWantsOnline(false);
          setError(data.error ?? holdMessage(data.hold));
          setWallet((current) => ({ ...current, hold: data.hold }));
        }
      }
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

        if (Date.now() - lastPresenceAt.current >= POSITION_MIN_GAP_MS) {
          lastPresenceAt.current = Date.now();
          void sendPresence(true);
        }
      },
      () => setError('Please allow location access so customers can be matched to you.'),
      { enableHighAccuracy: true, maximumAge: 15000 }
    );
    const timer = window.setInterval(() => {
      lastPresenceAt.current = Date.now();
      void sendPresence(true);
    }, 20000);
    return () => {
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(timer);
    };
  }, [isOnline, rider.isApproved, sendPresence]);

  // While a rider has an order in hand the customer follows them live. An online rider's position already goes out with the
  // heartbeat above; one who switched themselves offline (or is on payment hold: they may still finish the orders they hold)
  // sends it through the delivery ping, which writes the position and nothing else, so it never offers them for new requests.
  useEffect(() => {
    if (!rider.isApproved || !delivering || isOnline || !navigator.geolocation) return;

    let lastSent = 0;
    const send = (lat: number, lng: number) => {
      lastSent = Date.now();
      void fetch('/api/rider/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      }).catch(() => undefined);
    };
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        coords.current = { lat: position.coords.latitude, lng: position.coords.longitude };
        setHasLocation(true);
        setError('');

        if (Date.now() - lastSent >= POSITION_MIN_GAP_MS) send(position.coords.latitude, position.coords.longitude);
      },
      () => setError('Please allow location access so your customer can follow you.'),
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
    const timer = window.setInterval(() => {
      if (coords.current && Date.now() - lastSent >= POSITION_MIN_GAP_MS) send(coords.current.lat, coords.current.lng);
    }, 10000);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(timer);
    };
  }, [rider.isApproved, delivering, isOnline]);

  // A phone that locks its screen stops sending its position, so the customer's map would freeze: keep the screen awake while
  // an order is in hand (where the browser allows it; otherwise nothing changes).
  useEffect(() => {
    if (!delivering || !('wakeLock' in navigator)) return;

    let lock: WakeLockSentinel | null = null;
    let stopped = false;

    const acquire = async () => {
      try {
        const sentinel = await navigator.wakeLock.request('screen');

        if (stopped) void sentinel.release();
        else lock = sentinel;
      } catch {
        // Not allowed right now (low battery, hidden page): harmless, tracking still works while the screen is on.
      }
    };
    const reacquire = () => {
      if (document.visibilityState === 'visible' && (!lock || lock.released)) void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', reacquire);

    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', reacquire);
      void lock?.release();
    };
  }, [delivering]);

  useEffect(() => {
    enableNotificationSound();
  }, []);

  useEffect(() => {
    if (!rider.isApproved) return;
    let active = true;

    // A chime for what has just arrived: a new order request nearby, or a new message from a customer on an order the
    // rider has taken. The first poll only learns what is there already.
    const announceArrivals = (nextRequests: RiderChatSummary[], nextChats: RiderChatSummary[]) => {
      const knownRequests = knownRequestIds.current;
      const knownChats = knownChatStamps.current;

      if (knownRequests && knownChats) {
        const newRequest = nextRequests.some((chat) => !knownRequests.has(chat.id));
        const newCustomerMessage = nextChats.some((chat) => {
          const before = knownChats.get(chat.id);

          return before !== undefined && before !== chat.updatedAt && chat.lastMessageFrom === 'CUSTOMER';
        });
        // An order an area manager gave this rider appears among their chats without ever having been a request to reply to.
        const newAssignment = nextChats.some((chat) => !knownChats.has(chat.id) && !knownRequests.has(chat.id));

        if (newRequest || newCustomerMessage || newAssignment) playNotificationSound();
      }

      knownRequestIds.current = new Set(nextRequests.map((chat) => chat.id));
      knownChatStamps.current = new Map(nextChats.map((chat) => [chat.id, chat.updatedAt]));
    };

    const poll = async () => {
      try {
        const response = await fetch('/api/rider/chats');
        if (!response.ok) return;
        const data = await response.json();
        if (active) {
          const alive = (chat: RiderChatSummary) => !droppedChats.current.has(chat.id);
          const nextRequests = ((data.requests ?? []) as RiderChatSummary[]).filter(alive);
          const nextChats = ((data.chats ?? []) as RiderChatSummary[]).filter(alive);

          announceArrivals(nextRequests, nextChats);
          setRequests(nextRequests);
          setChats(nextChats);
          if (data.wallet) setWallet(data.wallet);
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

    if (next && wallet.hold) {
      setError(holdMessage(wallet.hold));
      return;
    }

    setError('');
    setWantsOnline(next);
    if (!next) {
      coords.current = null;
      setHasLocation(false);
    }
    await sendPresence(next);
  }, [isOnline, wallet.hold, sendPresence]);

  const dropChat = useCallback((chatId: string) => {
    droppedChats.current.add(chatId);
    setRequests((current) => current.filter((chat) => chat.id !== chatId));
    setChats((current) => current.filter((chat) => chat.id !== chatId));
  }, []);

  const value = useMemo(
    () => ({ rider, wallet, rules, isOnline, hasLocation, error, toggleOnline, requests, chats, delivering, dropChat }),
    [rider, wallet, rules, isOnline, hasLocation, error, toggleOnline, requests, chats, delivering, dropChat]
  );

  return <RiderContext.Provider value={value}>{children}</RiderContext.Provider>;
}

const RIDER_PAGES = {
  home: '/rider',
  requests: '/rider/requests',
  chats: '/rider/chats',
  history: '/rider/history',
  wallet: '/rider/wallet',
  messages: '/rider/messages',
} as const;

const RIDER_LINKS: { href: string; label: string; icon: LucideIcon; needsApproval?: boolean }[] = [
  { href: RIDER_PAGES.home, label: 'Dashboard', icon: LayoutDashboard },
  { href: RIDER_PAGES.requests, label: 'New requests', icon: Inbox, needsApproval: true },
  { href: RIDER_PAGES.chats, label: 'Order chats', icon: MessagesSquare, needsApproval: true },
  { href: RIDER_PAGES.history, label: 'Order history', icon: ClipboardList, needsApproval: true },
  { href: RIDER_PAGES.wallet, label: 'Wallet', icon: Wallet, needsApproval: true },
  { href: RIDER_PAGES.messages, label: 'Messages', icon: Headset },
];

function isActive(pathname: string, href: string) {
  return href === RIDER_PAGES.home ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const { rider, wallet, isOnline, requests } = useRider();

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
          const count = href === RIDER_PAGES.requests && !wallet.hold ? requests.length : 0;
          // The wallet link warns when the rider can't receive orders until they pay (or an admin lets them).
          const warn = href === RIDER_PAGES.wallet && wallet.hold !== null;

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
              {warn ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-bold text-brand-red-primary" aria-label="Action needed">
                  !
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
  const { delivering, hasLocation } = useRider();
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
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          {/* The customer's tracking page shows this rider live while they hold an order, so they are told it is happening. */}
          {delivering ? (
            <div
              role="status"
              data-testid="delivery-location-notice"
              className={`mb-6 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
                hasLocation ? 'border-green-200 bg-green-50 text-success' : 'border-yellow-200 bg-yellow-50 text-warning'
              }`}
            >
              <Navigation className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>
                <span className="font-semibold">Your customer can follow you live while you deliver.</span>{' '}
                {hasLocation ? 'Keep this page open and your location on.' : 'Waiting for your location: please allow location access.'}
              </p>
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}

/** The rider dashboard frame: left sidebar, notification bell and the page. Replaces the website's navbar there. */
export default function RiderShell({
  rider,
  wallet,
  rules,
  children,
}: {
  rider: RiderProfile;
  wallet: RiderWalletState;
  rules: RiderRules;
  children: ReactNode;
}) {
  return (
    <RiderProvider rider={rider} initialWallet={wallet} rules={rules}>
      <Frame>{children}</Frame>
    </RiderProvider>
  );
}
