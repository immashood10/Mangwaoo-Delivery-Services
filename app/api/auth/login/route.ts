import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSession, verifyPasswordOrDummy } from '@/lib/auth';
import { banMessage, banNotice } from '@/lib/ban-duration';
import { findActiveBan } from '@/lib/bans';
import { clientIp } from '@/lib/client-ip';
import { enforceRateLimits } from '@/lib/rate-limit';
import { canLogIn, requireVerificationAtLogin } from '@/lib/phone-verification';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const remember = body?.remember !== false;

  if (!email || !password || email.length > 254 || password.length > 1000) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  // Guessing passwords: a limit per network address and a stricter one per account.
  const limited = await enforceRateLimits(
    [
      { scope: 'login-ip', subject: clientIp(request), limit: 40, windowSeconds: 600 },
      { scope: 'login-email', subject: email, limit: 10, windowSeconds: 600 },
    ],
    'Too many login attempts. Please wait a few minutes and try again.'
  );

  if (limited) return limited;

  const user = await prisma.user.findUnique({ where: { email } });
  const passwordMatches = await verifyPasswordOrDummy(password, user?.password);

  // A deleted account has no email or password left, so it never gets this far; the check is for safety.
  if (!user || !passwordMatches || user.deletedAt) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  // Banned: only someone who knows the password is told (and told what the admin chose: "banned for 7 days").
  const ban = await findActiveBan(user.id);

  if (ban) {
    return NextResponse.json({ error: banMessage(ban), notice: banNotice(ban) }, { status: 403 });
  }

  // No session until the WhatsApp number is confirmed: a code is sent and the browser shows the code screen.
  if (!canLogIn(user)) {
    return requireVerificationAtLogin(request, user);
  }

  await createSession({ userId: user.id, role: user.role }, remember);

  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}
