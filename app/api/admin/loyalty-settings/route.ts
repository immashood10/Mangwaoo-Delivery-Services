import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { saveLoyaltySettings } from '@/lib/points';
import { parseLoyaltySettings } from '@/lib/points-config';

/**
 * Saves the rules of Mangwaoo Points: the points a delivered order wins, what a cashback costs and pays, the least a
 * customer can withdraw and the on / off switch. They apply from now on; points and money already in a wallet are untouched.
 */
export async function PUT(request: NextRequest) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = parseLoyaltySettings(body);

  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  await saveLoyaltySettings(parsed.settings);

  return NextResponse.json({ ok: true, settings: parsed.settings });
}
