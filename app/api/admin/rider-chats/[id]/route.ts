import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ORDER_RECORD_CHAT_SELECT, orderSnapshot, reconcileOrderRecords, recordRiderOrder } from '@/lib/rider-orders';

/**
 * Permanently deletes an order chat and all of its messages. Admin only. If a rider had taken the order, the rider's
 * history keeps a line for it: cancelled by Mangwaoo when it was still going, or (as for any finished order) the
 * delivered line, which is written first for orders finished before history was kept.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 });
  }

  const { id } = await params;

  const found = await prisma.$transaction(
    async (tx) => {
      const chat = await tx.riderChat.findUnique({ where: { id }, select: { status: true, ...ORDER_RECORD_CHAT_SELECT } });

      if (!chat) return false;

      const snapshot = orderSnapshot(chat);

      if (snapshot) {
        if (chat.status === 'ACTIVE') {
          await recordRiderOrder(tx, snapshot, { status: 'CANCELLED', cancelledBy: 'ADMIN' });
        } else if (chat.status === 'CLOSED') {
          await reconcileOrderRecords(tx, { chatId: id });
        }
      }

      await tx.riderChatMessage.deleteMany({ where: { chatId: id } });
      await tx.riderChatAttachment.deleteMany({ where: { chatId: id } });
      await tx.riderChat.delete({ where: { id } });

      return true;
    },
    { timeout: 20000, maxWait: 10000 }
  );

  if (!found) {
    return NextResponse.json({ error: 'Chat not found.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
