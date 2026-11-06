import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { PUBLIC_REEL } from '@/lib/reels';
import { enforceRateLimits } from '@/lib/rate-limit';
import { startOrContinueOrderChat } from '@/lib/order-chat';
import { parseCoordinates, distanceInKm, isRealLocation } from '@/lib/geo';
import { isInServiceArea } from '@/lib/service-area';
import { deliveryPlan } from '@/lib/delivery-policy';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'CUSTOMER') return NextResponse.json({ error: 'Please log in as a customer.', requiresLogin: true }, { status: 401 });
  const limited = await enforceRateLimits([{ scope: 'reel-order', subject: session.userId, limit: 20, windowSeconds: 3600 }]); if (limited) return limited;
  const body = await request.json().catch(() => null);
  const dropoff = parseCoordinates(String(body?.lat ?? ''), String(body?.lng ?? '')); const addressText = typeof body?.addressText === 'string' ? body.addressText.trim().slice(0, 300) : '';
  if (!isRealLocation(dropoff) || !addressText) return NextResponse.json({ error: 'Please choose your delivery address first.' }, { status: 400 });
  const { id } = await params;
  const [reel, customer] = await Promise.all([prisma.reel.findFirst({ where: { id, ...PUBLIC_REEL }, include: { linkedProduct: { include: { seller: { include: { user: { select: { isActive: true, deletedAt: true } } } } } }, author: { select: { name: true } } } }), prisma.customer.findUnique({ where: { userId: session.userId }, include: { user: { select: { name: true } } } })]);
  if (!reel || !customer) return NextResponse.json({ error: 'Reel not found.' }, { status: 404 });
  const dish = reel.linkedProduct;
  if (dish && (!dish.isActive || !dish.seller.isApproved || !dish.seller.user.isActive || !!dish.seller.user.deletedAt)) return NextResponse.json({ error: 'This dish is unavailable.' }, { status: 409 });
  const pickup = dish?.seller.latitude != null && dish.seller.longitude != null ? { lat: dish.seller.latitude, lng: dish.seller.longitude } : null;
  // Food reels enter the managed chat flow. Shipping-only listings are ordered through their listing/checkout instead.
  if (dish) {
    const plan = deliveryPlan({ days: dish.deliveryDays, distanceKm: pickup ? distanceInKm(pickup, dropoff) : null, sameCity: isInServiceArea(dropoff) && !!pickup && isInServiceArea(pickup) });
    if (plan.vendorFulfilled) return NextResponse.json({ error: plan.label + '. Please order this item from its listing so the vendor receives the shipping order.', listing: '/gulplaza/' + dish.id }, { status: 409 });
  } else if (!isInServiceArea(dropoff)) return NextResponse.json({ error: 'Custom food Chat orders are available in our Karachi service areas.' }, { status: 400 });
  try {
    const opened = await startOrContinueOrderChat({ customer: { id: customer.id, name: customer.user.name }, lat: dropoff.lat, lng: dropoff.lng, addressText, pickup, pickupText: dish ? dish.seller.businessName + ' · ' + dish.name : 'Food reel by ' + reel.author.name.split(' ')[0], text: 'Order from food reel: ' + reel.caption + (dish ? '\nDish: ' + dish.name + '\nRestaurant: ' + dish.seller.businessName : '\nPlease help me order this food.') + '\nReel: /reels?reel=' + reel.id, deliveryCharge: null, viaManager: true, requireManager: true });
    return NextResponse.json({ chat: opened.chat }, { status: opened.created ? 201 : 200 });
  } catch(e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Unable to open order chat.' }, { status: 409 }); }
}
