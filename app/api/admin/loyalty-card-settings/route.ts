import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { saveCardSettings } from '@/lib/loyalty-card';
import { parseCardSettings } from '@/lib/loyalty-card-config';

/**
 * Saves the rules of the Loyalty Card: how many delivered orders a customer needs to apply, the range of the random
 * discount, the most one order can be reduced by and the on / off switch. They apply from now on; cards already given,
 * and the discount a card holder's next order has already drawn, are untouched.
 */
export async function PUT(request: NextRequest) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = parseCardSettings(body);

  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  await saveCardSettings(parsed.settings);

  return NextResponse.json({ ok: true, settings: parsed.settings });
}
