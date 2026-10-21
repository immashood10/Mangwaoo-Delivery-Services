import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, hashPassword, verifyPassword } from '@/lib/auth';

const MIN_PASSWORD_LENGTH = 6;

/** A logged-in customer changes their password; the current one must be confirmed first. */
export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session || session.role !== 'CUSTOMER') {
    return NextResponse.json({ error: 'Please log in to change your password.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

  if (!currentPassword) {
    return NextResponse.json({ error: 'Please enter your current password.' }, { status: 400 });
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Your new password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { password: true } });

  if (!user || !(await verifyPassword(currentPassword, user.password))) {
    return NextResponse.json({ error: 'Your current password is not correct.' }, { status: 400 });
  }

  if (currentPassword === newPassword) {
    return NextResponse.json({ error: 'Your new password must be different from the current one.' }, { status: 400 });
  }

  await prisma.user.update({ where: { id: session.userId }, data: { password: await hashPassword(newPassword) } });

  return NextResponse.json({ ok: true });
}
