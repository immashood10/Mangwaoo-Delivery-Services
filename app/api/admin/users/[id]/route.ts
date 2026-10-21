import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { removeAccount } from '@/lib/account-removal';

/**
 * Deletes an account (see lib/account-removal.ts): logged out at once, personal details erased, open orders cancelled,
 * a seller's store taken down. Their email and number can be used to sign up again.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 });
  }

  const { id } = await params;
  const result = await removeAccount(id, session.userId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true, cancelledOrders: result.cancelledOrders });
}
