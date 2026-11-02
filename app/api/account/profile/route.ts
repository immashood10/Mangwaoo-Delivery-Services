import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { INVALID_PHONE_MESSAGE, isPhoneTakenByAnother, phoneVerificationRequired, startPhoneChange } from '@/lib/phone-verification';
import { normalizePakistaniMobile, toLocalPhone } from '@/lib/phone';
import { ageOnKarachiDate, type AudienceGender } from '@/lib/marketing-audience';

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

  const current = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { phone: true, customer: { select: { dateOfBirth: true, gender: true } } },
  });

  if (!current) {
    return NextResponse.json({ error: 'Please log in to change your settings.' }, { status: 401 });
  }

  let dateOfBirth = current.customer?.dateOfBirth ?? null;
  if (body?.dateOfBirth !== undefined) {
    if (body.dateOfBirth === null || body.dateOfBirth === '') {
      dateOfBirth = null;
    } else if (typeof body.dateOfBirth === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dateOfBirth)) {
      const parsed = new Date(`${body.dateOfBirth}T00:00:00.000Z`);
      if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== body.dateOfBirth) {
        return NextResponse.json({ error: 'Enter a valid date of birth.' }, { status: 400 });
      }
      dateOfBirth = parsed;
    } else {
      return NextResponse.json({ error: 'Enter a valid date of birth.' }, { status: 400 });
    }
  }

  if (dateOfBirth) {
    const age = ageOnKarachiDate(dateOfBirth);
    if (age < 18 || age > 120) {
      return NextResponse.json({ error: 'Age-based ad preferences are available only to adults (18+). You can leave this optional field blank.' }, { status: 400 });
    }
  }

  let gender: AudienceGender | null = current.customer?.gender ?? null;
  if (body?.gender !== undefined) {
    if (body.gender === null || body.gender === '') {
      gender = null;
    } else if (body.gender === 'MAN' || body.gender === 'WOMAN' || body.gender === 'NON_BINARY') {
      gender = body.gender;
    } else {
      return NextResponse.json({ error: 'Choose a valid gender option.' }, { status: 400 });
    }
  }

  if (!dateOfBirth) {
    if (body?.gender !== undefined && gender !== null) {
      return NextResponse.json({ error: 'Enter your date of birth to save an adult ad preference, or leave both fields blank.' }, { status: 400 });
    }
    gender = null;
  }

  const updateCustomer = prisma.customer.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId, dateOfBirth, gender },
    update: { dateOfBirth, gender },
  });
  const profile = { dateOfBirth: dateOfBirth?.toISOString().slice(0, 10) ?? null, gender };

  // The number wasn't touched: only the name changes.
  if (phone === current.phone) {
    const [user] = await prisma.$transaction([
      prisma.user.update({ where: { id: session.userId }, data: { name }, select: { name: true, phone: true } }),
      updateCustomer,
    ]);

    return NextResponse.json({ user, profile });
  }

  const whatsappNumber = normalizePakistaniMobile(phone);

  if (!whatsappNumber) {
    return NextResponse.json({ error: INVALID_PHONE_MESSAGE }, { status: 400 });
  }

  // The same number written another way (0300-1234567 / +92 300 1234567) is already confirmed.
  if (current.phone && normalizePakistaniMobile(current.phone) === whatsappNumber) {
    const [user] = await prisma.$transaction([
      prisma.user.update({
        where: { id: session.userId },
        data: { name, phone: toLocalPhone(whatsappNumber) },
        select: { name: true, phone: true },
      }),
      updateCustomer,
    ]);

    return NextResponse.json({ user, profile });
  }

  if (await isPhoneTakenByAnother(whatsappNumber, session.userId)) {
    return NextResponse.json({ error: 'Another account already uses this phone number.' }, { status: 409 });
  }

  // Verification is off: the new number is saved at once, no code.
  if (!phoneVerificationRequired()) {
    const [user] = await prisma.$transaction([
      prisma.user.update({
        where: { id: session.userId },
        data: { name, phone: toLocalPhone(whatsappNumber), phoneVerifiedAt: new Date() },
        select: { name: true, phone: true },
      }),
      updateCustomer,
    ]);

    return NextResponse.json({ user, profile });
  }

  const change = await startPhoneChange(request, session.userId, whatsappNumber, [
    prisma.user.update({ where: { id: session.userId }, data: { name } }),
    updateCustomer,
  ]);

  if (!change.ok) {
    return change.response;
  }

  // The name is saved; the account keeps its old number until the code is entered.
  return NextResponse.json({ user: { name, phone: current.phone }, profile, verification: change.info }, { status: 202 });
}
