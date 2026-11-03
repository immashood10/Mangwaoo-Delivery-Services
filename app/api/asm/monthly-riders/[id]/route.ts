import { NextRequest, NextResponse } from 'next/server';
import { requireManager } from '@/lib/area-managers';
import { changeMonthlyRider, quoteMonthlyBooking } from '@/lib/monthly-rider';
import { parseMonthlyQuote } from '@/lib/monthly-rider-config';
import { notifyMonthlyQuote, notifyMonthlyRiderChange } from '@/lib/monthly-rider-notices';

/**
 * An area manager deals with a monthly rider booking of THEIR area (another area's booking answers "not found"). `quote` sets
 * the price and rider for a request; `change-rider` gives a booking to another rider. Confirming payments and ending or
 * turning down a booking stay with the admins.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await requireManager();
  if ('error' in resolved) return resolved.error;

  const { manager } = resolved;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const who = { userId: manager.userId, areaId: manager.areaId };

  if (body?.action === 'quote') {
    const parsed = parseMonthlyQuote(body);

    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const result = await quoteMonthlyBooking(id, who, parsed);

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    notifyMonthlyQuote(id, result);

    return NextResponse.json({ ok: true });
  }

  if (body?.action === 'change-rider') {
    const riderId = typeof body.riderId === 'string' ? body.riderId.trim() : '';

    if (!riderId) return NextResponse.json({ error: 'Please choose the rider.' }, { status: 400 });

    const result = await changeMonthlyRider(id, who, riderId);

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    notifyMonthlyRiderChange(id, result);

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
