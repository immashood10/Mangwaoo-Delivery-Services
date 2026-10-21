import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clearSession, readSession } from '@/lib/auth';
import { getRestriction, restrictionNotice } from '@/lib/bans';

export async function GET() {
  const session = await readSession();

  if (!session) {
    return NextResponse.json({ user: null });
  }

  // A banned or deleted account is logged out here, once, and the browser is told why so it can show the notice
  // ("You have been banned for 7 days from Mangwaoo"). The next call has no cookie and just answers "nobody".
  const restriction = await getRestriction(session.userId);

  if (restriction) {
    await clearSession();

    return NextResponse.json({ user: null, notice: restrictionNotice(restriction) });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, role: true },
  });

  return NextResponse.json({ user });
}
