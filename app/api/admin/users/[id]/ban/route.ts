import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { banHeadline, parseBanInput } from '@/lib/ban-duration';
import { invalidateBanSnapshot } from '@/lib/bans';

async function requireAdmin() {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return { error: NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 }) };
  }

  return { adminId: session.userId };
}

/**
 * Bans an account for the length the admin typed (hours, days, weeks, months, years) or for good. The person is
 * logged out within seconds, can't log in until it ends, and is sent the notification "You have been banned for
 * 7 days from Mangwaoo". Banning someone who is already banned replaces the earlier ban.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await requireAdmin();
  if ('error' in resolved) return resolved.error;

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, name: true, deletedAt: true } });

  if (!target || target.deletedAt) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  }

  if (target.role === 'ADMIN') {
    return NextResponse.json({ error: "Admin accounts can't be banned." }, { status: 403 });
  }

  if (target.id === resolved.adminId) {
    return NextResponse.json({ error: "You can't ban your own account." }, { status: 403 });
  }

  const parsed = parseBanInput(await request.json().catch(() => null));

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { input } = parsed;
  const now = new Date();
  const summary = {
    permanent: input.permanent,
    durationLabel: input.permanent ? 'permanently' : input.durationLabel,
    endsAt: input.permanent ? null : input.endsAt,
    reason: input.reason,
  };

  const ban = await prisma.$transaction(async (tx) => {
    // A new ban takes the place of whatever ban was still open.
    await tx.userBan.updateMany({ where: { userId: id, liftedAt: null }, data: { liftedAt: now } });

    const created = await tx.userBan.create({
      data: { userId: id, permanent: summary.permanent, durationLabel: summary.durationLabel, endsAt: summary.endsAt, reason: summary.reason },
    });

    // The notification that goes to the person (they see the same words on the screen that logs them out).
    await tx.notification.create({
      data: {
        userId: id,
        type: 'ACCOUNT',
        title: 'Account banned',
        message: `${banHeadline(summary)}.${summary.reason ? ` Reason: ${summary.reason}` : ''}`,
        href: null,
        refId: `ban:${created.id}`,
      },
    });

    return created;
  });

  invalidateBanSnapshot();

  return NextResponse.json(
    {
      ban: {
        id: ban.id,
        permanent: ban.permanent,
        durationLabel: ban.durationLabel,
        endsAt: ban.endsAt ? ban.endsAt.toISOString() : null,
        reason: ban.reason,
        headline: banHeadline(summary),
      },
    },
    { status: 201 }
  );
}

/** Lifts the ban early; the person can log in again at once. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await requireAdmin();
  if ('error' in resolved) return resolved.error;

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, deletedAt: true } });

  if (!target || target.deletedAt) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  }

  const lifted = await prisma.$transaction(async (tx) => {
    const result = await tx.userBan.updateMany({ where: { userId: id, liftedAt: null }, data: { liftedAt: new Date() } });

    if (result.count > 0) {
      await tx.notification.create({
        data: {
          userId: id,
          type: 'ACCOUNT',
          title: 'Ban lifted',
          message: 'Your ban on Mangwaoo has been lifted. You can log in again.',
          href: null,
        },
      });
    }

    return result.count;
  });

  if (lifted === 0) {
    return NextResponse.json({ error: 'This account is not banned.' }, { status: 404 });
  }

  invalidateBanSnapshot();

  return NextResponse.json({ success: true });
}
