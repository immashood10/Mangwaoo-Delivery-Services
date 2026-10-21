import type { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { activeBanWhere } from '@/lib/bans';
import { RIDER_ONLINE_WINDOW_MS } from '@/lib/rider-dispatch';
import {
  FOOD_SELLER_TYPES,
  MAX_USER_SEARCH_LENGTH,
  USER_LIST_LIMIT,
  type AdminUserCounts,
  type AdminUserRow,
  type UserView,
} from '@/lib/admin-user-types';

// The lists behind the admin dashboard's cards (Admin > Users). Each view is exactly the set of accounts its card
// counts, so the number on the card and the number of rows here are the same.

// Accounts that finished signing up (confirmed their WhatsApp number), were not deleted, and are not admins.
const LIVE_ACCOUNTS: Prisma.UserWhereInput = { deletedAt: null, phoneVerifiedAt: { not: null }, role: { not: 'ADMIN' } };

function viewFilter(view: UserView, now: Date): Prisma.UserWhereInput {
  const onlineSince = new Date(now.getTime() - RIDER_ONLINE_WINDOW_MS);

  switch (view) {
    case 'customers':
      return { role: 'CUSTOMER' };
    case 'riders':
      return { role: 'RIDER' };
    case 'riders-online':
      return { role: 'RIDER', rider: { isApproved: true, isAvailable: true, lastSeenAt: { gte: onlineSince } } };
    case 'riders-pending':
      return { role: 'RIDER', rider: { isApproved: false } };
    case 'sellers':
      return { role: 'SELLER' };
    case 'sellers-pending':
      return { role: 'SELLER', seller: { sellerType: { in: [...FOOD_SELLER_TYPES] }, isApproved: false } };
    case 'banned':
      return { bans: { some: activeBanWhere(now) } };
  }
}

function searchFilter(search: string): Prisma.UserWhereInput {
  if (!search) return {};

  return {
    OR: [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
      { seller: { businessName: { contains: search, mode: 'insensitive' } } },
    ],
  };
}

export async function getAdminUsers(view: UserView, rawSearch: string) {
  const now = new Date();
  const search = rawSearch.trim().slice(0, MAX_USER_SEARCH_LENGTH);
  const where: Prisma.UserWhereInput = { AND: [LIVE_ACCOUNTS, viewFilter(view, now), searchFilter(search)] };
  const onlineSince = now.getTime() - RIDER_ONLINE_WINDOW_MS;

  const [users, total, customers, riders, sellers, banned] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: USER_LIST_LIMIT,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        customer: { select: { _count: { select: { orders: true, gulplazaOrders: true } } } },
        seller: { select: { businessName: true, sellerType: true, isApproved: true, city: true } },
        rider: { select: { vehicleType: true, isApproved: true, isAvailable: true, lastSeenAt: true } },
        bans: { where: activeBanWhere(now), orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
    prisma.user.count({ where }),
    prisma.user.count({ where: { AND: [LIVE_ACCOUNTS, viewFilter('customers', now)] } }),
    prisma.user.count({ where: { AND: [LIVE_ACCOUNTS, viewFilter('riders', now)] } }),
    prisma.user.count({ where: { AND: [LIVE_ACCOUNTS, viewFilter('sellers', now)] } }),
    prisma.user.count({ where: { AND: [LIVE_ACCOUNTS, viewFilter('banned', now)] } }),
  ]);

  const rows: AdminUserRow[] = users.map((user) => {
    const ban = user.bans[0];

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role as AdminUserRow['role'],
      createdAt: user.createdAt.toISOString(),
      seller: user.seller
        ? {
            businessName: user.seller.businessName,
            isFood: (FOOD_SELLER_TYPES as readonly string[]).includes(user.seller.sellerType),
            isApproved: user.seller.isApproved,
            city: user.seller.city,
          }
        : null,
      rider: user.rider
        ? {
            vehicleType: user.rider.vehicleType,
            isApproved: user.rider.isApproved,
            isOnline: user.rider.isApproved && user.rider.isAvailable && user.rider.lastSeenAt !== null && user.rider.lastSeenAt.getTime() >= onlineSince,
          }
        : null,
      orderCount: user.customer ? user.customer._count.orders + user.customer._count.gulplazaOrders : null,
      ban: ban
        ? {
            permanent: ban.permanent,
            durationLabel: ban.durationLabel,
            endsAt: ban.endsAt ? ban.endsAt.toISOString() : null,
            reason: ban.reason,
            startedAt: ban.createdAt.toISOString(),
          }
        : null,
    };
  });

  const counts: AdminUserCounts = { customers, riders, sellers, banned };

  return { rows, total, counts, search };
}
