import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSession, getSession, hashPassword, verifyPassword } from '@/lib/auth';
import { invalidateBanSnapshot } from '@/lib/bans';
import { passwordProblem } from '@/lib/password-policy';
import { enforceRateLimits } from '@/lib/rate-limit';

/** A logged-in customer (or an area manager, whose password the super admin first set) changes their password; the current one must be confirmed first. */
export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session || (session.role !== 'CUSTOMER' && session.role !== 'ASM')) {
    return NextResponse.json({ error: 'Please log in to change your password.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

  if (!currentPassword) {
    return NextResponse.json({ error: 'Please enter your current password.' }, { status: 400 });
  }

  // Someone holding a stolen login could try to find the current password.
  const limited = await enforceRateLimits([{ scope: 'password-change', subject: session.userId, limit: 10, windowSeconds: 3600 }]);

  if (limited) return limited;

  const problem = passwordProblem(newPassword);

  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { password: true } });

  if (!user || !(await verifyPassword(currentPassword, user.password))) {
    return NextResponse.json({ error: 'Your current password is not correct.' }, { status: 400 });
  }

  if (currentPassword === newPassword) {
    return NextResponse.json({ error: 'Your new password must be different from the current one.' }, { status: 400 });
  }

  // Every other login of this account ends; this browser gets a fresh one so the person stays logged in.
  await prisma.user.update({
    where: { id: session.userId },
    data: { password: await hashPassword(newPassword), sessionsValidFrom: new Date() },
  });
  invalidateBanSnapshot();
  await createSession({ userId: session.userId, role: session.role });

  return NextResponse.json({ ok: true });
}
