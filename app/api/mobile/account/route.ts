import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { orderRef } from '@/lib/order-number';
import { withPortionLabel } from '@/lib/food-portions';
import { getLoyaltyCardSummary } from '@/lib/loyalty-card';

/** Authenticated customer overview for the native app; reads the same account and orders as the website. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Please log in.' }, { status: 401 });
  if (session.role === 'RIDER') {
    const [user, rider] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, name: true, email: true, phone: true, role: true } }),
      prisma.rider.findUnique({ where: { userId: session.userId }, select: { isApproved: true, vehicleType: true, numberPlate: true, isAvailable: true } }),
    ]);
    if (!user || !rider) return NextResponse.json({ error: 'Rider account not found.' }, { status: 404 });
    return NextResponse.json({ user, rider }, { headers: { 'Cache-Control': 'private, no-store' } });
  }
  if (session.role !== 'CUSTOMER') return NextResponse.json({ error: 'This account does not have a customer dashboard.' }, { status: 403 });

  const customer = await prisma.customer.findUnique({ where: { userId: session.userId }, include: { user: true } });
  if (!customer) return NextResponse.json({ error: 'Customer account not found.' }, { status: 404 });

  const [martOrders, foodOrders, addresses, loyalty] = await Promise.all([
    prisma.order.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: 'desc' }, take: 60, include: { items: { include: { product: true } }, seller: true, address: true, payment: true, coupon: { select: { code: true } } } }),
    prisma.gulplazaOrder.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: 'desc' }, take: 60, include: { items: { include: { product: true } }, seller: true, address: true, payment: true, coupon: { select: { code: true } } } }),
    prisma.address.findMany({ where: { userId: session.userId, isSaved: true }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, label: true, street: true, latitude: true, longitude: true } }),
    getLoyaltyCardSummary(customer.id),
  ]);
  const points = await prisma.pointsEntry.aggregate({ where: { customerId: customer.id }, _sum: { points: true } });
  const pointsBalance = points._sum.points ?? 0;

  const orders = [
    ...martOrders.map((order) => ({ id: order.id, ref: orderRef('mart', order.orderNumber), marketplace: 'mart', status: order.status, totalAmount: Number(order.totalAmount), deliveryFee: 0, discountAmount: Number(order.discountAmount), loyaltyDiscount: Number(order.loyaltyDiscount), loyaltyPercent: order.loyaltyPercent, couponCode: order.coupon?.code ?? null, createdAt: order.createdAt.toISOString(), sellerName: order.seller.businessName, address: `${order.address.street}, ${order.address.city}`, paymentMethod: order.payment?.method ?? null, paymentStatus: order.payment?.status ?? null, items: order.items.map((item) => ({ id: item.id, productName: item.product.name, quantity: item.quantity, price: Number(item.price) })) })),
    ...foodOrders.map((order) => ({ id: order.id, ref: orderRef('gulplaza', order.orderNumber), marketplace: 'gulplaza', status: order.status, totalAmount: Number(order.totalAmount), deliveryFee: Number(order.deliveryFee), discountAmount: Number(order.discountAmount), loyaltyDiscount: Number(order.loyaltyDiscount), loyaltyPercent: order.loyaltyPercent, couponCode: order.coupon?.code ?? null, createdAt: order.createdAt.toISOString(), sellerName: order.seller.businessName, address: `${order.address.street}, ${order.address.city}`, paymentMethod: order.payment?.method ?? null, paymentStatus: order.payment?.status ?? null, items: order.items.map((item) => ({ id: item.id, productName: withPortionLabel(item.product.name, item.portionGrams), quantity: item.quantity, price: Number(item.price) })) })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json({
    user: { id: customer.user.id, name: customer.user.name, email: customer.user.email, phone: customer.user.phone },
    points: pointsBalance,
    loyalty,
    addresses: addresses.map((address) => ({ id: address.id, label: address.label ?? 'Other', street: address.street, lat: address.latitude, lng: address.longitude })),
    orders,
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}

/** Lets a customer update their display name from mobile without changing verified contact details. */
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Please log in.' }, { status: 401 });
  if (session.role !== 'CUSTOMER') return NextResponse.json({ error: 'Customer account required.' }, { status: 403 });
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  if (!name || name.length > 80) return NextResponse.json({ error: 'Please enter your name (up to 80 characters).' }, { status: 400 });
  const user = await prisma.user.update({ where: { id: session.userId }, data: { name }, select: { id: true, name: true, email: true, phone: true, role: true } });
  return NextResponse.json({ user });
}
