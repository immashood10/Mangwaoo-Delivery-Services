'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  LayoutDashboard,
  ListOrdered,
  TrendingUp,
  Users,
  LogOut,
  MapPin,
  Megaphone,
  Menu,
  MessageSquare,
  Package,
  PackagePlus,
  Settings,
  ShoppingCart,
  Store,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { SELLER_PAGES, type NotificationSnapshot } from '@/lib/notification-types';
import { NotificationBell, SellerNotificationsProvider, useSellerNotifications } from './SellerNotifications';

const SELLER_LINKS: { href: string; label: string; icon: LucideIcon; martOnly?: boolean }[] = [
  { href: SELLER_PAGES.dashboard, label: 'Dashboard', icon: LayoutDashboard },
  { href: SELLER_PAGES.sales, label: 'Sales', icon: TrendingUp },
  { href: SELLER_PAGES.customers, label: 'Customers', icon: Users },
  { href: SELLER_PAGES.allOrders, label: 'All orders', icon: ListOrdered },
  { href: SELLER_PAGES.reports, label: 'Reports', icon: FileText },
  { href: SELLER_PAGES.post, label: 'Post product', icon: PackagePlus },
  { href: SELLER_PAGES.products, label: 'Your products', icon: Package },
  { href: SELLER_PAGES.cart, label: 'Pending — still in cart', icon: ShoppingCart },
  { href: SELLER_PAGES.orders, label: 'Incoming orders', icon: ClipboardList },
  { href: SELLER_PAGES.completed, label: 'Completed orders', icon: CheckCircle2 },
  { href: SELLER_PAGES.stats, label: 'Your stats', icon: BarChart3 },
  // Ads promote MangwaooMart products; food businesses don't have them yet.
  { href: SELLER_PAGES.ads, label: 'Run an ad', icon: Megaphone, martOnly: true },
  { href: SELLER_PAGES.messages, label: 'Messages', icon: MessageSquare },
  { href: SELLER_PAGES.settings, label: 'Settings', icon: Settings },
];

function isActive(pathname: string, href: string) {
  return href === SELLER_PAGES.post ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

type ShellProfile = {
  storeName: string;
  ownerName: string;
  isApproved: boolean;
  isFood: boolean;
  /** The kitchen / shop is pinned on the map (food sellers without a pin aren't shown to customers). */
  hasLocation: boolean;
  /** Shown under the logo, e.g. "Seller dashboard" or "Food seller dashboard". */
  dashboardLabel: string;
};

function SidebarContent({ profile, onNavigate }: { profile: ShellProfile; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const { counts } = useSellerNotifications();

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
            <Store className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-bold leading-tight">{profile.storeName}</p>
            <p className="text-xs text-white/60">{profile.dashboardLabel}</p>
          </div>
        </div>

        <div
          className={`mt-3 ml-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            profile.isApproved ? 'bg-green-500/15 text-green-300' : 'bg-yellow-500/15 text-yellow-300'
          }`}
        >
          {profile.isApproved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
          {profile.isApproved ? 'Approved seller' : 'Pending approval'}
        </div>

        {profile.isFood && !profile.hasLocation ? (
          <Link
            href={SELLER_PAGES.settings}
            onClick={onNavigate}
            className="mx-3 mt-3 flex items-start gap-2 rounded-xl bg-yellow-500/15 px-3 py-2 text-xs font-semibold text-yellow-300 transition hover:bg-yellow-500/25"
          >
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Pin your restaurant on the map in Settings. Customers only see restaurants within 5 km of them, so yours is hidden until you do.</span>
          </Link>
        ) : null}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4" aria-label="Seller dashboard">
        {SELLER_LINKS.filter((link) => !(link.martOnly && profile.isFood)).map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          const unread = counts[href] ?? 0;

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
              {unread > 0 ? (
                <span
                  className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-bold text-brand-red-primary"
                  aria-label={`${unread} new`}
                >
                  {unread > 99 ? '99+' : unread}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="mb-2 flex items-center gap-2 px-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
            {profile.ownerName.charAt(0).toUpperCase()}
          </span>
          <span className="truncate text-sm text-white/80">{profile.ownerName}</span>
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

function Frame({ profile, children }: { profile: ShellProfile; children: ReactNode }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();
  const currentLabel = SELLER_LINKS.find((link) => isActive(pathname, link.href))?.label ?? 'Seller dashboard';

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
        <SidebarContent profile={profile} />
      </aside>

      {/* Mobile: top bar with a menu button that opens the same sidebar as a drawer */}
      <div className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-brand-dark px-4 py-3 text-white lg:hidden">
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="rounded-lg p-1.5 hover:bg-white/10"
          aria-label="Open seller menu"
        >
          <Menu className="h-6 w-6" />
        </button>
        <p className="flex-1 truncate font-semibold">{currentLabel}</p>
        <NotificationBell onDark />
      </div>

      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setIsMobileOpen(false)}
            aria-label="Close seller menu"
          />
          <div className="relative h-full w-72 max-w-[85vw]">
            <SidebarContent profile={profile} onNavigate={() => setIsMobileOpen(false)} />
            <button
              type="button"
              onClick={() => setIsMobileOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-white/80 hover:bg-white/10"
              aria-label="Close seller menu"
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
          <NotificationBell />
        </header>
        <div>{children}</div>
      </div>
    </div>
  );
}

/** The seller dashboard frame: left sidebar (with unread badges), notifications bell, and the page itself. */
export default function SellerShell({
  profile,
  initialNotifications,
  children,
}: {
  profile: ShellProfile;
  initialNotifications: NotificationSnapshot;
  children: ReactNode;
}) {
  return (
    <SellerNotificationsProvider initial={initialNotifications}>
      <Frame profile={profile}>{children}</Frame>
    </SellerNotificationsProvider>
  );
}
