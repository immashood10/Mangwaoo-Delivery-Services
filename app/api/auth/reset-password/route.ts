import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { invalidateBanSnapshot } from '@/lib/bans';
import { clientIp } from '@/lib/client-ip';
import { passwordProblem } from '@/lib/password-policy';
import { enforceRateLimits } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === 'string' ? body.token : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  const limited = await enforceRateLimits([{ scope: 'reset-ip', subject: clientIp(request), limit: 20, windowSeconds: 3600 }]);

  if (limited) return limited;

  if (!token || token.length > 200) {
    return NextResponse.json({ error: 'Please provide a valid token and a new password.' }, { status: 400 });
  }

  const problem = passwordProblem(password);

  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return NextResponse.json(
      { error: 'This reset link is invalid or has expired. Please request a new one.' },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);

  // Changing the password also ends every login the account had (a stolen cookie stops working).
  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { password: passwordHash, sessionsValidFrom: new Date() } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
  ]);
  invalidateBanSnapshot();

  return NextResponse.json({ success: true });
}
