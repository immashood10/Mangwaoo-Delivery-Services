import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { isAllowedPushEndpoint, pushConfigured, saveSubscription } from '@/lib/push';
import { prisma } from '@/lib/prisma';
import { enforceRateLimits } from '@/lib/rate-limit';

const MAX_KEY_LENGTH = 200;

function readSubscription(body: unknown) {
  const input = body as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
  const endpoint = typeof input?.endpoint === 'string' ? input.endpoint : '';
  const p256dh = typeof input?.keys?.p256dh === 'string' ? input.keys.p256dh : '';
  const auth = typeof input?.keys?.auth === 'string' ? input.keys.auth : '';

  if (!isAllowedPushEndpoint(endpoint) || !p256dh || !auth || p256dh.length > MAX_KEY_LENGTH || auth.length > MAX_KEY_LENGTH) {
    return null;
  }

  return { endpoint, p256dh, auth };
}

// A logged-in person turns push notifications on for this browser/phone.
export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Please log in to turn on notifications.' }, { status: 401 });
  }

  if (!pushConfigured()) {
    return NextResponse.json({ error: 'Push notifications are not set up on this site yet.' }, { status: 503 });
  }

  const limited = await enforceRateLimits([{ scope: 'push-subscribe', subject: session.userId, limit: 30, windowSeconds: 3600 }]);

  if (limited) return limited;

  const subscription = readSubscription(await request.json().catch(() => null));

  if (!subscription) {
    return NextResponse.json({ error: 'That notification address is not valid.' }, { status: 400 });
  }

  await saveSubscription(session.userId, subscription);

  return NextResponse.json({ ok: true }, { status: 201 });
}

// Turns push notifications off for one browser/phone (only the account's own subscription can be removed).
export async function DELETE(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ ok: true });
  }

  const body = await request.json().catch(() => null);
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : '';

  if (endpoint) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: session.userId } });
  }

  return NextResponse.json({ ok: true });
}
