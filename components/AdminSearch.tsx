'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, PackageCheck, Search, UserRound, X } from 'lucide-react';

type UserHit = { id: string; name: string; role: string; detail: string; href: string };
type OrderHit = { ref: string; status: string; customer: string; seller: string };
type Item = { key: string; href: string; icon: 'page' | 'user' | 'order'; title: string; detail: string };

const SEARCH_PAUSE_MS = 300;
const MIN_LENGTH = 2;

const ICONS = { page: LayoutDashboard, user: UserRound, order: PackageCheck };

/**
 * The admin panel's search box: type a person (name, phone, email, shop), an order (MW-F10001, or the customer's / shop's
 * name) or a page of the panel. Pages are matched here; people and orders are asked of /api/admin/search after a short pause.
 * Enter opens the first result, the arrow keys move, Escape closes.
 */
export default function AdminSearch({
  pages,
  onNavigate,
  placeholder = 'Search people, orders, pages…',
}: {
  pages: { href: string; label: string }[];
  onNavigate?: () => void;
  placeholder?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserHit[]>([]);
  const [orders, setOrders] = useState<OrderHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const trimmed = query.trim();
  const searching = trimmed.length >= MIN_LENGTH;

  useEffect(() => {
    if (!searching) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setFailed(false);

      try {
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });

        if (!response.ok) throw new Error('search failed');

        const data = (await response.json()) as { users: UserHit[]; orders: OrderHit[] };

        setUsers(data.users);
        setOrders(data.orders);
        setLoading(false);
      } catch (error) {
        if ((error as { name?: string })?.name === 'AbortError') return;

        setUsers([]);
        setOrders([]);
        setFailed(true);
        setLoading(false);
      }
    }, SEARCH_PAUSE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, searching]);

  useEffect(() => {
    if (!open) return;

    const close = (event: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('pointerdown', close);

    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const items = useMemo<Item[]>(() => {
    if (!searching) return [];

    const needle = trimmed.toLowerCase();
    const pageItems: Item[] = pages
      .filter((page) => page.label.toLowerCase().includes(needle))
      .map((page) => ({ key: `page:${page.href}`, href: page.href, icon: 'page', title: page.label, detail: 'Page' }));
    const orderItems: Item[] = orders.map((order) => ({
      key: `order:${order.ref}`,
      href: `/admin/orders?q=${encodeURIComponent(order.ref)}`,
      icon: 'order',
      title: `Order ${order.ref}`,
      detail: `${order.customer} · ${order.seller} · ${order.status.replace(/_/g, ' ').toLowerCase()}`,
    }));
    const userItems: Item[] = users.map((user) => ({ key: `user:${user.id}`, href: user.href, icon: 'user', title: user.name, detail: `${user.role}${user.detail ? ` · ${user.detail}` : ''}` }));

    return [...pageItems, ...orderItems, ...userItems];
  }, [pages, orders, users, trimmed, searching]);

  const go = (item: Item) => {
    setOpen(false);
    setQuery('');
    router.push(item.href);
    onNavigate?.();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      if (items.length) setActive((current) => (current + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length);
      return;
    }

    if (event.key === 'Enter' && items.length) {
      event.preventDefault();
      go(items[Math.min(active, items.length - 1)]);
    }
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gray" aria-hidden />
      <input
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label="Search the admin panel"
        data-testid="admin-search"
        maxLength={80}
        autoComplete="off"
        className="w-full rounded-full border border-gray-200 bg-surface py-2 pl-9 pr-9 text-sm text-ink outline-none transition placeholder:text-brand-gray focus:border-accent focus:ring-2 focus:ring-accent/20 [&::-webkit-search-cancel-button]:hidden"
      />
      {query ? (
        <button
          type="button"
          onClick={() => {
            setQuery('');
            setOpen(false);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-brand-gray hover:text-ink"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}

      {open && trimmed.length > 0 ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-gray-100 bg-surface p-2 shadow-lg" data-testid="admin-search-results">
          {!searching ? (
            <p className="px-3 py-3 text-sm text-brand-gray">Type at least {MIN_LENGTH} letters.</p>
          ) : (
            <>
              {items.length > 0 ? (
                <ul role="listbox">
                  {items.map((item, index) => {
                    const Icon = ICONS[item.icon];

                    return (
                      <li key={item.key} role="option" aria-selected={index === active}>
                        <button
                          type="button"
                          onClick={() => go(item)}
                          onMouseEnter={() => setActive(index)}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${index === active ? 'bg-brand-light' : ''}`}
                        >
                          <Icon className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-ink">{item.title}</span>
                            <span className="block truncate text-xs text-brand-gray">{item.detail}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {loading ? <p className="px-3 py-2 text-xs text-brand-gray">Searching…</p> : null}
              {failed ? <p className="px-3 py-2 text-xs text-danger">Search did not work. Try again.</p> : null}
              {!loading && !failed && items.length === 0 ? <p className="px-3 py-3 text-sm text-brand-gray">Nothing found for &ldquo;{trimmed}&rdquo;.</p> : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
