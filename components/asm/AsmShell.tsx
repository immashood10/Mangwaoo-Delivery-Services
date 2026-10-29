'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Bike, LogOut, Menu, MessagesSquare, UserCog, X, type LucideIcon } from 'lucide-react';
import { NotificationBell, SellerNotificationsProvider } from '@/components/seller/SellerNotifications';
import { useAuth } from '@/lib/auth-context';
import { ASM_PAGES } from '@/lib/notification-types';

const EMPTY_NOTIFICATIONS = { items: [], counts: {} };
// Orders are time-sensitive for a manager, so the bell looks a little more often than a customer's.
const NOTIFICATIONS_POLL_MS = 10000;

const ASM_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: ASM_PAGES.orders, label: 'Orders', icon: MessagesSquare },
  { href: ASM_PAGES.riders, label: 'Riders', icon: Bike },
  { href: '/asm/account', label: 'My account', icon: UserCog },
];

function isActive(pathname: string, href: string) {
  return href === ASM_PAGES.orders ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarContent({ name, areaName, onNavigate }: { name: string; areaName: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

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
            <UserCog className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-bold leading-tight">{name}</p>
            <p className="text-xs text-white/60">Area manager · {areaName}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4" aria-label="Area manager">
        {ASM_LINKS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);

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
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="mb-2 flex items-center gap-2 px-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
            {name.charAt(0).toUpperCase()}
          </span>
          <span className="truncate text-sm text-white/80">{name}</span>
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

/** The Area Sales Manager's frame: sidebar on the left, the bell above the page. Replaces the website's navbar there. */
export default function AsmShell({ name, areaName, children }: { name: string; areaName: string; children: ReactNode }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();
  const currentLabel = ASM_LINKS.find((link) => isActive(pathname, link.href))?.label ?? 'Area manager';

  useEffect(() => {
    if (!isMobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileOpen]);

  return (
    <SellerNotificationsProvider initial={EMPTY_NOTIFICATIONS} endpoint="/api/notifications" pollMs={NOTIFICATIONS_POLL_MS} fetchOnMount>
      <div className="flex min-h-screen flex-col bg-brand-light lg:flex-row">
        {/* Desktop: fixed-width sidebar that stays in view while the page scrolls */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">
          <SidebarContent name={name} areaName={areaName} />
        </aside>

        {/* Mobile: top bar with a menu button that opens the same sidebar as a drawer */}
        <div className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-brand-dark px-4 py-3 text-white lg:hidden">
          <button type="button" onClick={() => setIsMobileOpen(true)} className="rounded-lg p-1.5 hover:bg-white/10" aria-label="Open manager menu">
            <Menu className="h-6 w-6" />
          </button>
          <p className="flex-1 truncate font-semibold">{currentLabel}</p>
          <NotificationBell onDark />
        </div>

        {isMobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button type="button" className="absolute inset-0 bg-black/60" onClick={() => setIsMobileOpen(false)} aria-label="Close manager menu" />
            <div className="relative h-full w-72 max-w-[85vw]">
              <SidebarContent name={name} areaName={areaName} onNavigate={() => setIsMobileOpen(false)} />
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="absolute right-3 top-3 rounded-lg p-1.5 text-white/80 hover:bg-white/10"
                aria-label="Close manager menu"
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
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
        </div>
      </div>
    </SellerNotificationsProvider>
  );
}
