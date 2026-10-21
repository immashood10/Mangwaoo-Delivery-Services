import { NextRequest, NextResponse } from 'next/server';
import { createSession, getSession } from '@/lib/auth';
import { banMessage, banNotice } from '@/lib/ban-duration';
import { findActiveBan } from '@/lib/bans';
import { ADMIN_PAGES } from '@/lib/notification-types';
import { notifyAdminsAfterResponse } from '@/lib/notify';
import { verifyCode, verifyFirebaseToken } from '@/lib/phone-verification';
import { usesFirebasePhone } from '@/lib/firebase-phone';
import { CODE_LENGTH } from '@/lib/phone-verification-types';

const JOINED_NOTICES: Partial<Record<string, { title: string; href: string }>> = {
  CUSTOMER: { title: 'New customer', href: ADMIN_PAGES.users },
  SELLER: { title: 'New seller waiting for approval', href: ADMIN_PAGES.sellers },
  RIDER: { title: 'New rider waiting for approval', href: ADMIN_PAGES.riders },
};

/**
 * The code screen's "Verify": a right code confirms the WhatsApp number. For a new or unconfirmed account that
 * is also what logs it in (no session exists before this); for a number change in Settings the session is
 * already there and only the number is replaced.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const ticket = typeof body?.ticket === 'string' ? body.ticket : '';
  const code = typeof body?.code === 'string' ? body.code.trim() : '';
  const idToken = typeof body?.idToken === 'string' ? body.idToken : '';
  const remember = body?.remember !== false;

  if (!ticket) {
    return NextResponse.json({ error: 'This verification has expired. Please start again.', restart: true }, { status: 400 });
  }

  const firebase = usesFirebasePhone();

  if (firebase ? !idToken : !new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code)) {
    return NextResponse.json({ error: `Please enter the ${CODE_LENGTH}-digit code from WhatsApp.` }, { status: 400 });
  }

  const session = await getSession();
  const result = firebase ? await verifyFirebaseToken(ticket, idToken, session?.userId ?? null) : await verifyCode(ticket, code, session?.userId ?? null);

  if (!result.ok) {
    return result.response;
  }

  if (result.purpose === 'ACCOUNT') {
    // A finished signup is news for the admins (an unverified signup never shows up in their lists).
    const joined = JOINED_NOTICES[result.user.role];

    if (joined) {
      notifyAdminsAfterResponse(async () => ({
        type: 'ACCOUNT' as const,
        title: joined.title,
        message: `${result.user.name} (${result.user.email}).`,
        href: joined.href,
        refId: `joined:${result.user.id}`,
      }));
    }

    // The number is confirmed, but an account that was banned in the meantime still gets no session.
    const ban = await findActiveBan(result.user.id);

    if (ban) {
      return NextResponse.json({ error: banMessage(ban), notice: banNotice(ban) }, { status: 403 });
    }

    await createSession({ userId: result.user.id, role: result.user.role }, remember);
  }

  return NextResponse.json({ purpose: result.purpose, user: result.user });
}
