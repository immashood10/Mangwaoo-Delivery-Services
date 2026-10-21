'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BadgePercent,
  CircleDashed,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessageCircle,
  MessagesSquare,
  PackageCheck,
  Bike,
  Store,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { NotificationBell, useSellerNotifications } from '@/components/seller/SellerNotifications';

const ADMIN_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/orders', label: 'Orders', icon: PackageCheck },
  { href: '/admin/rider-chats', label: 'Order Chats', icon: MessagesSquare },
  { href: '/admin/messages', label: 'Messages', icon: MessageCircle },
  { href: '/admin/sellers', label: 'Seller Approvals', icon: Store },
  { href: '/admin/riders', label: 'Rider Approvals', icon: Bike },
  { href: '/admin/ads', label: 'Ad Requests', icon: Megaphone },
  { href: '/admin/stories', label: 'Stories', icon: CircleDashed },
  { href: '/admin/discounts', label: 'Discount', icon: BadgePercent },
];

function isActive(pathname: string, href: string) {
  return href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);
}

export function adminPageTitle(pathname: string) {
  return ADMIN_LINKS.find((link) => isActive(pathname, link.href))?.label ?? 'Admin';
}

function SidebarContent({ adminName, onNavigate }: { adminName: string; onNavigate?: () => void }) {
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
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-red-primary to-brand-red-secondary">
            <span className="text-sm font-bold">M</span>
          </div>
          <div>
            <p className="font-bold leading-tight">Mangwaoo</p>
            <p className="text-xs text-white/60">Admin panel</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {ADMIN_LINKS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          const unseen = counts[href] ?? 0;
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
              <Icon className="h-4 w-4" />
              <span className="flex-1">{label}</span>
              {unseen > 0 ? (
                <span
                  aria-label={`${unseen} new`}
                  className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-red-primary px-1.5 text-[10px] font-bold text-white ring-1 ring-white/30"
                >
                  {unseen > 99 ? '99+' : unseen}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="mb-2 flex items-center gap-2 px-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
            {adminName.charAt(0).toUpperCase()}
          </span>
          <span className="truncate text-sm text-white/80">{adminName}</span>
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

export default function AdminSidebar({ adminName }: { adminName: string }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();
  const currentLabel = adminPageTitle(pathname);

  useEffect(() => {
    if (!isMobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileOpen]);

  return (
    <>
      {/* Desktop: fixed-width sidebar that stays in view while the page scrolls */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">
        <SidebarContent adminName={adminName} />
      </aside>

      {/* Mobile: top bar with a menu button that opens the same sidebar as a drawer */}
      <div className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-brand-dark px-4 py-3 text-white lg:hidden">
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="rounded-lg p-1.5 hover:bg-white/10"
          aria-label="Open admin menu"
        >
          <Menu className="h-6 w-6" />
        </button>
        <p className="flex-1 truncate font-semibold">{currentLabel}</p>
        <NotificationBell onDark />
        <Link href="/" className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-white/80 hover:bg-white/10">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setIsMobileOpen(false)}
            aria-label="Close admin menu"
          />
          <div className="relative h-full w-72 max-w-[85vw]">
            <SidebarContent adminName={adminName} onNavigate={() => setIsMobileOpen(false)} />
            <button
              type="button"
              onClick={() => setIsMobileOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-white/80 hover:bg-white/10"
              aria-label="Close admin menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
