import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  Bike,
  CircleDashed,
  Clock,
  Flag,
  LayoutDashboard,
  MapPin,
  Megaphone,
  MessagesSquare,
  PackageCheck,
  ShieldCheck,
  ShoppingCart,
  Store,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RIDER_ONLINE_WINDOW_MS } from '@/lib/rider-dispatch';
import AutoRefresh from '@/components/AutoRefresh';
import { riderChatMessagePreview } from '@/lib/rider-chat-types';
import AdminCharts from '@/components/AdminCharts';
import { CHART_RANGES, getAdminChartData, parseChartRange, startOfKarachiDay } from '@/lib/admin-stats';

export const metadata = {
  title: 'Admin Dashboard - Mangwaoo',
};

const FOOD_SELLER_TYPES = ['GULPLAZA_OWNER', 'WHOLESALER'] as const;
const RECENT_WAITING_CHATS = 5;

// Accounts that finished signing up (confirmed their WhatsApp number) and were not deleted: the ones the cards count.
const LIVE_ACCOUNT = { phoneVerifiedAt: { not: null }, deletedAt: null } as const;

async function getDashboardData() {
  const now = Date.now();
  const startOfTodayKarachi = new Date(startOfKarachiDay(now));
  const onlineSince = new Date(now - RIDER_ONLINE_WINDOW_MS);

  const [
    pendingRiders,
    approvedRiders,
    onlineRiders,
    pendingFoodSellers,
    approvedFoodSellers,
    waitingChats,
    activeChats,
    chatsToday,
    customers,
    martOrdersToday,
    foodOrdersToday,
    recentWaitingChats,
    pendingAds,
    cartCustomers,
  ] = await Promise.all([
    // Pending riders / sellers who haven't confirmed their WhatsApp number are unfinished signups, not counted.
    prisma.rider.count({ where: { isApproved: false, user: LIVE_ACCOUNT } }),
    prisma.rider.count({ where: { isApproved: true, user: { deletedAt: null } } }),
    prisma.rider.count({
      where: { isApproved: true, isAvailable: true, lastSeenAt: { gte: onlineSince }, user: { deletedAt: null } },
    }),
    prisma.seller.count({
      where: { sellerType: { in: [...FOOD_SELLER_TYPES] }, isApproved: false, user: LIVE_ACCOUNT },
    }),
    prisma.seller.count({ where: { sellerType: { in: [...FOOD_SELLER_TYPES] }, isApproved: true } }),
    prisma.riderChat.count({ where: { status: 'OPEN' } }),
    prisma.riderChat.count({ where: { status: 'ACTIVE' } }),
    prisma.riderChat.count({ where: { createdAt: { gte: startOfTodayKarachi } } }),
    prisma.customer.count({ where: { user: LIVE_ACCOUNT } }),
    prisma.order.count({ where: { createdAt: { gte: startOfTodayKarachi } } }),
    prisma.gulplazaOrder.count({ where: { createdAt: { gte: startOfTodayKarachi } } }),
    prisma.riderChat.findMany({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      take: RECENT_WAITING_CHATS,
      include: {
        customer: { include: { user: { select: { name: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
    prisma.productAd.count({ where: { status: 'PENDING' } }),
    // Customers with items in their cart that they haven't ordered (the Still in Cart page).
    prisma.customer.count({ where: { user: LIVE_ACCOUNT, cartItems: { some: {} } } }),
  ]);

  return {
    pendingAds,
    cartCustomers,
    pendingRiders,
    approvedRiders,
    onlineRiders,
    pendingFoodSellers,
    approvedFoodSellers,
    waitingChats,
    activeChats,
    chatsToday,
    customers,
    ordersToday: martOrdersToday + foodOrdersToday,
    recentWaitingChats: recentWaitingChats.map((chat) => ({
      id: chat.id,
      customerName: chat.customer.user.name,
      addressText: chat.addressText,
      pickupText: chat.pickupText,
      lastMessage: chat.messages[0] ? riderChatMessagePreview(chat.messages[0]) : null,
      waitingMinutes: Math.max(0, Math.round((now - chat.createdAt.getTime()) / 60000)),
    })),
  };
}

function StatCard({
  label,
  value,
  icon: Icon,
  href,
  tone = 'default',
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  /** The list behind the number. */
  href: string;
  tone?: 'default' | 'alert' | 'good';
}) {
  const toneClass =
    tone === 'alert' && value > 0
      ? 'bg-amber-50 text-warning'
      : tone === 'good' && value > 0
        ? 'bg-green-50 text-success'
        : 'bg-brand-red-primary/10 text-accent';

  return (
    <Link
      href={href}
      className="group block rounded-2xl bg-surface p-5 shadow-soft transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div className="mb-3 flex items-start justify-between">
        <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <ArrowRight className="h-4 w-4 text-brand-gray transition group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden="true" />
      </div>
      <p className="text-3xl font-bold text-ink">{value}</p>
      <p className="text-sm text-brand-gray">{label}</p>
    </Link>
  );
}

function SectionCard({
  href,
  title,
  description,
  icon: Icon,
  badge,
}: {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-2xl bg-surface p-5 shadow-soft transition hover:shadow-md"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-red-primary to-brand-red-secondary text-white">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-bold text-ink">{title}</h2>
          {badge ? (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-white">{badge}</span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-brand-gray">{description}</p>
      </div>
      <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-brand-gray transition group-hover:translate-x-1 group-hover:text-accent" />
    </Link>
  );
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    redirect('/login?next=/admin');
  }

  const rangeDays = parseChartRange((await searchParams).range);
  const [data, chartData] = await Promise.all([getDashboardData(), getAdminChartData(rangeDays)]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <AutoRefresh />

      <div className="inline-flex items-center gap-2 rounded-full bg-brand-red-primary/10 px-4 py-2 text-sm font-semibold text-accent mb-3">
        <LayoutDashboard className="w-4 h-4" />
        Admin
      </div>
      <h1 className="text-3xl font-bold text-ink mb-2">Admin Dashboard</h1>
      <p className="text-brand-gray mb-8">
        Live overview of riders, sellers and order chats. Updates every 30 seconds. Click a number to see the list behind it.
      </p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-10">
        <StatCard label="Chats waiting for a rider" value={data.waitingChats} icon={Clock} tone="alert" href="/admin/rider-chats?filter=waiting" />
        <StatCard label="Riders online now" value={data.onlineRiders} icon={Bike} tone="good" href="/admin/users?view=riders-online" />
        <StatCard label="Riders pending approval" value={data.pendingRiders} icon={ShieldCheck} tone="alert" href="/admin/riders" />
        <StatCard label="Food sellers pending" value={data.pendingFoodSellers} icon={Store} tone="alert" href="/admin/users?view=sellers-pending" />
        <StatCard label="Chats with a rider" value={data.activeChats} icon={MessagesSquare} href="/admin/rider-chats?filter=with-rider" />
        <StatCard label="Order chats today" value={data.chatsToday} icon={MessagesSquare} href="/admin/rider-chats?filter=today" />
        <StatCard label="Orders placed today" value={data.ordersToday} icon={PackageCheck} href="/admin/orders" />
        <StatCard label="Customers" value={data.customers} icon={Users} href="/admin/users?view=customers" />
      </div>

      <div className="mb-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink">Stats</h2>
          <div className="flex rounded-full bg-surface p-1 shadow-soft" role="group" aria-label="Date range">
            {CHART_RANGES.map((range) => (
              <Link
                key={range}
                href={`/admin?range=${range}`}
                scroll={false}
                aria-current={range === rangeDays ? 'true' : undefined}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  range === rangeDays ? 'bg-brand-dark text-white' : 'text-brand-gray hover:text-ink'
                }`}
              >
                Last {range} days
              </Link>
            ))}
          </div>
        </div>
        <AdminCharts data={chartData} />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink">Manage</h2>
          <SectionCard
            href="/admin/rider-chats"
            title="Order Chats"
            description="Read every customer order chat and reply as Mangwaoo Support."
            icon={MessagesSquare}
            badge={data.waitingChats > 0 ? `${data.waitingChats} waiting` : undefined}
          />
          <SectionCard
            href="/admin/users?view=riders"
            title="Riders"
            description={`${data.approvedRiders} approved riders. Ban or delete a rider, and see who is pending approval.`}
            icon={Bike}
            badge={data.pendingRiders > 0 ? `${data.pendingRiders} pending` : undefined}
          />
          <SectionCard
            href="/admin/users"
            title="Users"
            description="Customers, riders and sellers: see everyone, ban an account for hours up to years (or for good), or delete it."
            icon={Users}
          />
          <SectionCard
            href="/admin/sellers"
            title="Seller Approvals"
            description={`${data.approvedFoodSellers} approved food sellers. New food businesses appear on Food once approved.`}
            icon={Store}
            badge={data.pendingFoodSellers > 0 ? `${data.pendingFoodSellers} pending` : undefined}
          />
          <SectionCard
            href="/admin/ads"
            title="Ad Requests"
            description="Check the EasyPaisa / JazzCash payment for each seller ad (including one-day story ads), then approve it to start it."
            icon={Megaphone}
            badge={data.pendingAds > 0 ? `${data.pendingAds} pending` : undefined}
          />
          <SectionCard
            href="/admin/carts"
            title="Still in Cart"
            description="Customers who put items in their cart but haven't ordered. See what is waiting, from which shop, and remind them."
            icon={ShoppingCart}
            badge={data.cartCustomers > 0 ? `${data.cartCustomers} waiting` : undefined}
          />
          <SectionCard
            href="/admin/stories"
            title="Stories"
            description="Post a photo or message on the Mangwaoo logo. Everyone can watch it for a day, like a WhatsApp status."
            icon={CircleDashed}
          />
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink">Waiting for a rider</h2>
            {data.recentWaitingChats.length > 0 && (
              <Link href="/admin/rider-chats" className="text-sm font-semibold text-accent hover:underline">
                View all
              </Link>
            )}
          </div>

          {data.recentWaitingChats.length === 0 ? (
            <p className="rounded-2xl bg-surface p-5 text-sm text-brand-gray shadow-soft">
              No customers are waiting right now.
            </p>
          ) : (
            <div className="space-y-3">
              {data.recentWaitingChats.map((chat) => (
                <Link
                  key={chat.id}
                  href="/admin/rider-chats"
                  className="block rounded-2xl border border-amber-200 bg-amber-50 p-4 transition hover:border-accent"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-semibold text-ink">{chat.customerName}</p>
                    <span className="shrink-0 text-xs font-semibold text-warning">
                      {chat.waitingMinutes < 1 ? 'just now' : `${chat.waitingMinutes} min waiting`}
                    </span>
                  </div>
                  {chat.lastMessage ? <p className="mt-1 line-clamp-2 text-sm text-ink">{chat.lastMessage}</p> : null}
                  {chat.pickupText ? (
                    <p className="mt-1 flex items-center gap-1 truncate text-xs text-brand-gray">
                      <MapPin className="h-3 w-3 shrink-0 text-success" />
                      <span className="truncate">Pickup: {chat.pickupText}</span>
                    </p>
                  ) : null}
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-brand-gray">
                    <Flag className="h-3 w-3 shrink-0 text-accent" />
                    <span className="truncate">{chat.pickupText ? 'Drop-off: ' : ''}{chat.addressText}</span>
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
