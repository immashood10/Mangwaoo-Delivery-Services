import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/** The logged-in customer behind a Loyalty Card request, or the answer to send instead. */
export async function getCardCustomer() {
  const session = await getSession();

  if (!session || session.role !== 'CUSTOMER') {
    return { error: NextResponse.json({ error: 'Please log in as a customer to use the Loyalty Card.', requiresLogin: true }, { status: 401 }) };
  }

  const customer = await prisma.customer.findUnique({
    where: { userId: session.userId },
    select: { id: true, userId: true, user: { select: { name: true } } },
  });

  if (!customer) return { error: NextResponse.json({ error: 'Customer account not found.' }, { status: 404 }) };

  return { customer };
}
