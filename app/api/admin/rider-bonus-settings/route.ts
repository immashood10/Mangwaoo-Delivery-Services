import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { saveBonusSettings } from '@/lib/rider-bonus';
import { parseBonusSettings } from '@/lib/rider-bonus-config';

/**
 * Saves the rules of the riders' delivery bonus: the two distances that split orders into short, middle and long, the lowest and
 * highest bonus of each, and the on / off switch. They apply to orders completed from now on; bonuses already paid stay.
 */
export async function PUT(request: NextRequest) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = parseBonusSettings(body);

  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  await saveBonusSettings(parsed.settings);

  return NextResponse.json({ ok: true, settings: parsed.settings });
}
