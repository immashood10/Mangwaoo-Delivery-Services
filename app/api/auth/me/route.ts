import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clearSession, readSession } from '@/lib/auth';
import { getRestriction, isSessionRevoked, restrictionNotice } from '@/lib/bans';

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

  // The password was changed or reset after this cookie was issued: it is void.
  if (await isSessionRevoked(session.userId, session.iat)) {
    await clearSession();

    return NextResponse.json({ user: null });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, role: true },
  });

  return NextResponse.json({ user });
}
