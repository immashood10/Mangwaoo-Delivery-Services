import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSession, hashPassword } from '@/lib/auth';

const SELLER_TYPES = ['MART', 'GULPLAZA_OWNER', 'WHOLESALER'] as const;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const businessName = typeof body?.businessName === 'string' ? body.businessName.trim() : '';
  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const sellerType = SELLER_TYPES.includes(body?.sellerType) ? body.sellerType : 'MART';

  if (!businessName || !fullName || !email || !phone || password.length < 6) {
    return NextResponse.json({ error: 'Please fill in all fields with a password of at least 6 characters.' }, { status: 400 });
  }

  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
  });

  if (existingUser) {
    return NextResponse.json({ error: 'An account with this email or phone already exists.' }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name: fullName,
      email,
      phone,
      password: passwordHash,
      role: 'SELLER',
      seller: { create: { businessName, sellerType } },
    },
  });

  await createSession({ userId: user.id, role: user.role });

  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } }, { status: 201 });
}
