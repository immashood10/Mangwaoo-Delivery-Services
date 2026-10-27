import { prisma } from '@/lib/prisma';
import { ORDER_RECORD_CHAT_SELECT, orderSnapshot, recordRiderOrder } from '@/lib/rider-orders';

export type CancelOutcome =
  | { kind: 'missing' }
  /** The order was already completed, so it can't be cancelled any more. */
  | { kind: 'completed' }
  | {
      kind: 'cancelled';
      /** A rider had taken the order (so there is someone to tell). */
      hadRider: boolean;
      customer: { userId: string; name: string };
      rider: { userId: string; name: string } | null;
    };

/**
 * Cancels an order chat: the whole conversation (messages, photos, voice notes) and the chat itself are deleted, for
 * both sides ("order will be cancelled and chats will disappear"). Only a chat that is still going (OPEN or ACTIVE) can
 * be cancelled; a completed one (CLOSED) has already been charged to the rider and stays as it is.
 *
 * The chat row is locked first, so a rider completing the order at the very same moment and this cancel can't both
 * win: whichever gets the lock first decides, the other one is told.
 *
 * `by` is who pressed "End chat". When a rider had already taken the order, the order stays in that rider's history as
 * cancelled (the chat is the only thing deleted), written here before the chat goes.
 */
export async function cancelOrderChat(chatId: string, by: 'RIDER' | 'CUSTOMER'): Promise<CancelOutcome> {
  return prisma.$transaction(
    async (tx) => {
      const locked = await tx.$queryRaw<{ status: string }[]>`
        SELECT "status"::text AS "status" FROM "RiderChat" WHERE "id" = ${chatId} FOR UPDATE`;

      if (locked.length === 0) return { kind: 'missing' } as const;
      if (locked[0].status === 'CLOSED') return { kind: 'completed' } as const;

      const chat = await tx.riderChat.findUnique({
        where: { id: chatId },
        select: {
          ...ORDER_RECORD_CHAT_SELECT,
          rider: { select: { userId: true, user: { select: { name: true } } } },
        },
      });

      if (!chat) return { kind: 'missing' } as const;

      const snapshot = orderSnapshot(chat);
      if (snapshot) await recordRiderOrder(tx, snapshot, { status: 'CANCELLED', cancelledBy: by });

      // Messages first, then their attachments, then the chat (the same order the admin's "Delete" uses).
      await tx.riderChatMessage.deleteMany({ where: { chatId } });
      await tx.riderChatAttachment.deleteMany({ where: { chatId } });
      await tx.riderChat.delete({ where: { id: chatId } });

      return {
        kind: 'cancelled',
        hadRider: chat.riderId !== null,
        customer: { userId: chat.customer.userId, name: chat.customer.user.name },
        rider: chat.rider ? { userId: chat.rider.userId, name: chat.rider.user.name } : null,
      } as const;
    },
    { timeout: 20000, maxWait: 10000 }
  );
}
