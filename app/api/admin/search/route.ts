import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { orderRef } from '@/lib/order-number';
import { MAX_USER_SEARCH_LENGTH } from '@/lib/admin-user-types';
import { orderSearchWhere } from '@/lib/admin-order-search';

// The admin panel's search box: accounts (customers, riders, sellers) and orders that match what was typed. Pages are matched in
// the browser. Admin only; at most 6 of each so the dropdown stays short (the Users and Orders pages show the full lists).

const LIMIT = 6;

const VIEW_BY_ROLE: Record<string, string> = { CUSTOMER: 'customers', RIDER: 'riders', SELLER: 'sellers' };
const ROLE_LABELS: Record<string, string> = { CUSTOMER: 'Customer', RIDER: 'Rider', SELLER: 'Seller' };

export async function GET(request: NextRequest) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 401 });
  }

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, MAX_USER_SEARCH_LENGTH);

  if (q.length < 2) return NextResponse.json({ users: [], orders: [] }, { headers: { 'Cache-Control': 'no-store' } });

  const orderWhere = orderSearchWhere(q);
  const include = {
    seller: { select: { businessName: true } },
    customer: { select: { user: { select: { name: true } } } },
  } as const;

  const [users, martOrders, foodOrders] = await Promise.all([
    prisma.user.findMany({
      where: {
        deletedAt: null,
        phoneVerifiedAt: { not: null },
        role: { in: ['CUSTOMER', 'RIDER', 'SELLER'] },
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
          { seller: { businessName: { contains: q, mode: 'insensitive' } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
      select: { id: true, name: true, email: true, phone: true, role: true, seller: { select: { businessName: true } } },
    }),
    orderWhere ? prisma.order.findMany({ where: orderWhere.mart, orderBy: { createdAt: 'desc' }, take: LIMIT, include }) : [],
    orderWhere ? prisma.gulplazaOrder.findMany({ where: orderWhere.food, orderBy: { createdAt: 'desc' }, take: LIMIT, include }) : [],
  ]);

  const orders = [
    ...martOrders.map((order) => ({ createdAt: order.createdAt, ref: orderRef('mart', order.orderNumber), status: order.status, customer: order.customer.user.name, seller: order.seller.businessName })),
    ...foodOrders.map((order) => ({ createdAt: order.createdAt, ref: orderRef('gulplaza', order.orderNumber), status: order.status, customer: order.customer.user.name, seller: order.seller.businessName })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, LIMIT)
    .map((order) => ({ ref: order.ref, status: order.status, customer: order.customer, seller: order.seller }));

  return NextResponse.json(
    {
      users: users.map((user) => ({
        id: user.id,
        name: user.seller?.businessName ? `${user.seller.businessName} (${user.name})` : user.name,
        role: ROLE_LABELS[user.role] ?? user.role,
        detail: user.phone ?? user.email ?? '',
        href: `/admin/users?view=${VIEW_BY_ROLE[user.role] ?? 'customers'}&q=${encodeURIComponent(user.email || user.name)}`,
      })),
      orders,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
