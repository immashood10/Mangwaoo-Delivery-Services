import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimits } from '@/lib/rate-limit';
import { ADMIN_PAGES, ASM_PAGES } from '@/lib/notification-types';
import { notifyAreaManagers } from '@/lib/area-managers';
import { notifyAdminsAfterResponse } from '@/lib/notify';
import { createMonthlyRequest } from '@/lib/monthly-rider';
import { parseMonthlyRequest } from '@/lib/monthly-rider-config';
import { getMonthlyRiderCustomer } from '@/lib/monthly-rider-request';

/**
 * "Book a monthly rider": the customer says where, from when and what for. An admin or the area's manager then sets the price
 * and picks the rider. Every admin and the area's managers are told there is a request waiting.
 */
export async function POST(request: NextRequest) {
  const resolved = await getMonthlyRiderCustomer();
  if ('error' in resolved) return resolved.error;

  const limited = await enforceRateLimits(
    [{ scope: 'monthly-rider-request', subject: resolved.customer.userId, limit: 5, windowSeconds: 3600 }],
    'You are doing that too often. Please wait a little and try again.'
  );

  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const parsed = parseMonthlyRequest(body);

  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const result = await createMonthlyRequest(resolved.customer.id, parsed.request);

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const message = `${result.customerName} wants a monthly rider in ${result.areaName} (${result.ref}). Set a price and pick a rider.`;

  notifyAdminsAfterResponse(async () => ({
    type: 'ORDER' as const,
    title: 'Monthly rider request',
    message,
    href: ADMIN_PAGES.monthlyRiders,
    refId: `monthly-rider:${result.id}`,
  }));
  notifyAreaManagers(parsed.request.areaId, {
    title: 'Monthly rider request',
    message,
    href: ASM_PAGES.monthlyRiders,
    refId: `monthly-rider:${result.id}`,
  });

  return NextResponse.json({ ok: true, ref: result.ref }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
