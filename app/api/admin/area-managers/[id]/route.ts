import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseManagerChange, requireSuperAdmin, updateManager } from '@/lib/area-managers';
import { removeAccount } from '@/lib/account-removal';
import { enforceRateLimits } from '@/lib/rate-limit';

/** Changes a manager: their area, their password (their old logins end) or their name. Super admin only. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if ('error' in auth) return auth.error;

  const limited = await enforceRateLimits([{ scope: 'asm-change', subject: auth.adminId, limit: 60, windowSeconds: 3600 }]);
  if (limited) return limited;

  const { id } = await params;
  const manager = await prisma.areaManager.findUnique({ where: { id }, select: { user: { select: { email: true } } } });

  if (!manager) {
    return NextResponse.json({ error: 'Area manager not found.' }, { status: 404 });
  }

  const parsed = parseManagerChange(await request.json().catch(() => null), manager.user.email);

  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await updateManager(id, parsed.patch);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ manager: result.manager });
}

/**
 * Removes a manager: they are logged out at once and the account is emptied like any removed account (see
 * lib/account-removal.ts). When it was the last manager of the area, that area's orders go back to the riders.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if ('error' in auth) return auth.error;

  const { id } = await params;
  const manager = await prisma.areaManager.findUnique({ where: { id }, select: { userId: true } });

  if (!manager) {
    return NextResponse.json({ error: 'Area manager not found.' }, { status: 404 });
  }

  const result = await removeAccount(manager.userId, auth.adminId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
