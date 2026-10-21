import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { INVALID_PHONE_MESSAGE, isPhoneTakenByAnother, startPhoneChange } from '@/lib/phone-verification';
import { normalizePakistaniMobile, toLocalPhone } from '@/lib/phone';

const MAX_NAME_LENGTH = 80;

/**
 * A customer edits their own name and phone number from Settings. The name is saved straight away; a different
 * phone number is only a request until its owner enters the code sent to it on WhatsApp (see /api/auth/verify-code),
 * so a confirmed account can't end up with a number nobody confirmed.
 */
export async function PATCH(request: NextRequest) {
  const session = await getSession();

  if (!session || session.role !== 'CUSTOMER') {
    return NextResponse.json({ error: 'Please log in to change your settings.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';

  if (!name || name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: `Please enter your name (up to ${MAX_NAME_LENGTH} characters).` }, { status: 400 });
  }

  const current = await prisma.user.findUnique({ where: { id: session.userId }, select: { phone: true } });

  if (!current) {
    return NextResponse.json({ error: 'Please log in to change your settings.' }, { status: 401 });
  }

  // The number wasn't touched: only the name changes.
  if (phone === current.phone) {
    const user = await prisma.user.update({ where: { id: session.userId }, data: { name }, select: { name: true, phone: true } });

    return NextResponse.json({ user });
  }

  const whatsappNumber = normalizePakistaniMobile(phone);

  if (!whatsappNumber) {
    return NextResponse.json({ error: INVALID_PHONE_MESSAGE }, { status: 400 });
  }

  // The same number written another way (0300-1234567 / +92 300 1234567) is already confirmed.
  if (current.phone && normalizePakistaniMobile(current.phone) === whatsappNumber) {
    const user = await prisma.user.update({
      where: { id: session.userId },
      data: { name, phone: toLocalPhone(whatsappNumber) },
      select: { name: true, phone: true },
    });

    return NextResponse.json({ user });
  }

  if (await isPhoneTakenByAnother(whatsappNumber, session.userId)) {
    return NextResponse.json({ error: 'Another account already uses this phone number.' }, { status: 409 });
  }

  const change = await startPhoneChange(request, session.userId, whatsappNumber, [
    prisma.user.update({ where: { id: session.userId }, data: { name } }),
  ]);

  if (!change.ok) {
    return change.response;
  }

  // The name is saved; the account keeps its old number until the code is entered.
  return NextResponse.json({ user: { name, phone: current.phone }, verification: change.info }, { status: 202 });
}
