import { NextRequest, NextResponse } from 'next/server';
import { getFoodRecommendations } from '@/lib/food-ai-catalog';
import { getSession } from '@/lib/auth';
import { clientIp } from '@/lib/client-ip';
import { parseCoordinates } from '@/lib/geo';
import { prisma } from '@/lib/prisma';
import { enforceRateLimits } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const session = await getSession();
  const customerSession = session?.role === 'CUSTOMER' ? session : null;
  const ip = clientIp(request);
  if (!ip && !customerSession) return NextResponse.json({ products: [], hasOrderHistory: false, hasNearby: false });

  const limited = await enforceRateLimits([
    { scope: 'food-recommendations-ip', subject: ip, limit: 60, windowSeconds: 3600 },
    { scope: 'food-recommendations-user', subject: customerSession?.userId, limit: 60, windowSeconds: 3600 },
  ], 'Recommendations are loading too often. Try again shortly.');
  if (limited) return limited;

  const params = request.nextUrl.searchParams;
  const origin = parseCoordinates(params.get('lat') ?? undefined, params.get('lng') ?? undefined);
  const customer = customerSession
    ? await prisma.customer.findUnique({ where: { userId: customerSession.userId }, select: { id: true } })
    : null;
  const recommendations = await getFoodRecommendations({ customerId: customer?.id, origin });
  return NextResponse.json(recommendations, { headers: { 'Cache-Control': 'no-store' } });
}
