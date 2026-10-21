import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { SupportPerson } from '@/lib/support-types';

const MAX_RESULTS = 12;

// Search the sellers and riders the admin can start a message with (by name, store, email or phone).
export async function GET(request: NextRequest) {
  const session = await getSession();

  if (session?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 401 });
  }

  const term = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 80);

  if (term.length < 2) {
    return NextResponse.json({ people: [] satisfies SupportPerson[] });
  }

  const contains = { contains: term, mode: 'insensitive' as const };
  const users = await prisma.user.findMany({
    where: {
      role: { in: ['SELLER', 'RIDER'] },
      deletedAt: null,
      phoneVerifiedAt: { not: null },
      OR: [{ name: contains }, { email: contains }, { phone: contains }, { seller: { businessName: contains } }],
    },
    orderBy: { name: 'asc' },
    take: MAX_RESULTS,
    select: { id: true, name: true, email: true, role: true, seller: { select: { businessName: true } } },
  });

  const people: SupportPerson[] = users.map((user) => ({
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role === 'RIDER' ? 'RIDER' : 'SELLER',
    businessName: user.seller?.businessName ?? null,
  }));

  return NextResponse.json({ people });
}
