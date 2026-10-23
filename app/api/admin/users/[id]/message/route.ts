import { after, NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { sendPushToUsers } from '@/lib/push';
import { enforceRateLimits } from '@/lib/rate-limit';
import { ADMIN_MESSAGE_TITLE, MAX_ADMIN_MESSAGE_LENGTH } from '@/lib/notification-types';

/**
 * An admin's message to one account (Admin > Users > Send notification). It becomes a notification from
 * "Mangwaoo" in that person's bell (customers and riders have one in the navbar, sellers in their dashboard) and,
 * if they allowed it, a push on their phone. Every send is its own notification; nothing is folded.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  // The only page a message may open is the customer's cart (the "Still in Cart" reminder).
  const href = body?.href === '/cart' ? '/cart' : null;

  if (!message) {
    return NextResponse.json({ error: 'Please write a message.' }, { status: 400 });
  }

  if (message.length > MAX_ADMIN_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `The message can be at most ${MAX_ADMIN_MESSAGE_LENGTH} characters.` }, { status: 400 });
  }

  const limited = await enforceRateLimits([{ scope: 'admin-notify', subject: session.userId, limit: 120, windowSeconds: 3600 }]);

  if (limited) return limited;

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, role: true, deletedAt: true } });

  if (!target || target.deletedAt) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  }

  if (target.role === 'ADMIN') {
    return NextResponse.json({ error: "Admin accounts can't be messaged here." }, { status: 403 });
  }

  await prisma.notification.create({
    data: { userId: target.id, type: 'MESSAGE', title: ADMIN_MESSAGE_TITLE, message, href },
  });

  // The phone is told after the answer; a failure there never undoes the saved message.
  after(() => sendPushToUsers([target.id], { title: ADMIN_MESSAGE_TITLE, body: message, url: href ?? '/' }));

  return NextResponse.json({ ok: true }, { status: 201 });
}
