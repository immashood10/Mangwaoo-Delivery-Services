import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Search, Users } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { getAdminUsers } from '@/lib/admin-users';
import { parseUserView, type UserView } from '@/lib/admin-user-types';
import AdminUsers from '@/components/AdminUsers';
import AutoRefresh from '@/components/AutoRefresh';

export const metadata = {
  title: 'Users - Mangwaoo Admin',
};

const VIEW_TITLES: Record<UserView, string> = {
  customers: 'Customers',
  riders: 'Riders',
  'riders-online': 'Riders online now',
  'riders-pending': 'Riders pending approval',
  sellers: 'Sellers',
  'sellers-pending': 'Food sellers pending approval',
  banned: 'Banned accounts',
};

const EMPTY_MESSAGES: Record<UserView, string> = {
  customers: 'No customers yet.',
  riders: 'No riders yet.',
  'riders-online': 'No riders are online right now.',
  'riders-pending': 'No riders are waiting for approval.',
  sellers: 'No sellers yet.',
  'sellers-pending': 'No food sellers are waiting for approval.',
  banned: 'Nobody is banned right now.',
};

type Group = 'customers' | 'riders' | 'sellers' | 'banned';

const groupOf = (view: UserView): Group => (view.startsWith('riders') ? 'riders' : view.startsWith('sellers') ? 'sellers' : view === 'banned' ? 'banned' : 'customers');

const SUB_FILTERS: Partial<Record<Group, { view: UserView; label: string }[]>> = {
  riders: [
    { view: 'riders', label: 'All riders' },
    { view: 'riders-online', label: 'Online now' },
    { view: 'riders-pending', label: 'Pending approval' },
  ],
  sellers: [
    { view: 'sellers', label: 'All sellers' },
    { view: 'sellers-pending', label: 'Food pending approval' },
  ],
};

const href = (view: UserView, search: string) => `/admin/users?view=${view}${search ? `&q=${encodeURIComponent(search)}` : ''}`;

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string }> }) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    redirect('/admin/login');
  }

  const { view: rawView, q } = await searchParams;
  const view = parseUserView(rawView);
  const group = groupOf(view);
  const { rows, total, counts, search } = await getAdminUsers(view, q ?? '');

  const tabs: { group: Group; view: UserView; label: string; count: number }[] = [
    { group: 'customers', view: 'customers', label: 'Customers', count: counts.customers },
    { group: 'riders', view: 'riders', label: 'Riders', count: counts.riders },
    { group: 'sellers', view: 'sellers', label: 'Sellers', count: counts.sellers },
    { group: 'banned', view: 'banned', label: 'Banned', count: counts.banned },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      {view === 'riders-online' ? <AutoRefresh /> : null}

      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-red-primary/10 px-4 py-2 text-sm font-semibold text-accent">
        <Users className="h-4 w-4" />
        Admin
      </div>
      <h1 className="mb-2 text-3xl font-bold text-ink">{VIEW_TITLES[view]}</h1>
      <p className="mb-6 max-w-3xl text-brand-gray">
        Ban an account for a few hours up to years (or for good), or delete it. A banned person is logged out and sees
        &ldquo;You have been banned for … from Mangwaoo&rdquo; instead of logging in.
      </p>

      <nav aria-label="Account types" className="mb-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.group}
            href={href(tab.view, search)}
            aria-current={tab.group === group ? 'page' : undefined}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              tab.group === group ? 'bg-brand-dark text-white' : 'bg-surface text-ink shadow-soft hover:text-accent'
            }`}
          >
            {tab.label} <span className={tab.group === group ? 'text-white/70' : 'text-brand-gray'}>{tab.count}</span>
          </Link>
        ))}
      </nav>

      {SUB_FILTERS[group] ? (
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter">
          {SUB_FILTERS[group]!.map((filter) => (
            <Link
              key={filter.view}
              href={href(filter.view, search)}
              aria-current={filter.view === view ? 'true' : undefined}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                filter.view === view ? 'border-accent bg-red-50 text-accent' : 'border-gray-200 text-brand-gray hover:border-accent hover:text-accent'
              }`}
            >
              {filter.label}
            </Link>
          ))}
        </div>
      ) : null}

      <form method="get" action="/admin/users" className="mb-6 flex gap-2">
        <input type="hidden" name="view" value={view} />
        <label htmlFor="user-search" className="sr-only">
          Search by name, email, phone or store
        </label>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gray" />
          <input
            id="user-search"
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search by name, email, phone or store"
            className="w-full rounded-xl border border-gray-300 bg-transparent py-2.5 pl-9 pr-4 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-red-100"
          />
        </div>
        <button type="submit" className="rounded-xl bg-brand-dark px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90">
          Search
        </button>
        {search ? (
          <Link href={href(view, '')} className="flex items-center rounded-xl px-3 text-sm font-semibold text-brand-gray hover:text-ink">
            Clear
          </Link>
        ) : null}
      </form>

      {view === 'sellers-pending' ? (
        <p className="mb-4 rounded-xl bg-brand-light px-4 py-3 text-sm text-brand-gray">
          To approve or decline these businesses, use{' '}
          <Link href="/admin/sellers" className="font-semibold text-accent hover:underline">
            Seller Approvals
          </Link>
          . Here you can ban or delete them.
        </p>
      ) : null}

      <p className="mb-3 text-sm text-brand-gray">
        {total === 0
          ? search
            ? `Nothing matches “${search}”.`
            : ''
          : total > rows.length
            ? `Showing the newest ${rows.length} of ${total}. Search to find the rest.`
            : `${total} ${total === 1 ? 'account' : 'accounts'}${search ? ` matching “${search}”` : ''}`}
      </p>

      <AdminUsers rows={rows} emptyMessage={search ? `Nothing matches “${search}”.` : EMPTY_MESSAGES[view]} />

    </div>
  );
}
