import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { prepareSignup, signupWriteFailed } from '@/lib/phone-verification';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!fullName || !email || !phone || password.length < 6) {
    return NextResponse.json({ error: 'Please fill in all fields with a password of at least 6 characters.' }, { status: 400 });
  }

  const passwordHash = hashPassword(password);

  // Sends the WhatsApp code too; the account below is created unverified and can't log in until it is entered.
  const signup = await prepareSignup(request, { email, phone });

  if (!signup.ok) {
    return signup.response;
  }

  try {
    await prisma.$transaction(
      signup.writes(
        prisma.user.create({
          data: {
            name: fullName,
            email,
            phone: signup.phone,
            password: await passwordHash,
            role: 'CUSTOMER',
            customer: { create: {} },
            phoneVerification: { create: signup.record },
          },
        })
      )
    );
  } catch (error) {
    return signupWriteFailed(error);
  }

  return NextResponse.json({ verification: signup.info }, { status: 201 });
}
