import { after } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { NotificationKind } from '@/lib/notification-types';

export type NotifyInput = {
  userId: string;
  type: NotificationKind;
  title: string;
  message: string;
  href: string;
  /** Repeat events with the same refId fold into one unread notification instead of piling up. */
  refId?: string;
};

async function saveNotification(input: NotifyInput) {
  if (input.refId) {
    const refreshed = await prisma.notification.updateMany({
      where: { userId: input.userId, refId: input.refId, isRead: false },
      data: { title: input.title, message: input.message, href: input.href, createdAt: new Date() },
    });

    if (refreshed.count > 0) return;
  }

  await prisma.notification.create({ data: input });
}

/**
 * Builds and stores notifications after the response has been sent, so they never slow the
 * request down — and a failure here can never break the customer's order, message or like.
 */
export function notifyAfterResponse(build: () => Promise<NotifyInput | NotifyInput[] | null>) {
  after(async () => {
    try {
      const built = await build();
      const inputs = built ? (Array.isArray(built) ? built : [built]) : [];
      await Promise.all(inputs.map(saveNotification));
    } catch (error) {
      console.error('Could not save notification:', error);
    }
  });
}

export type AdminNotifyInput = Omit<NotifyInput, 'userId'>;

/**
 * Like `notifyAfterResponse`, but the notification goes to every admin account (their bell in the admin panel).
 * `href` should be a plain admin page path: opening that page marks it as seen.
 */
export function notifyAdminsAfterResponse(build: () => Promise<AdminNotifyInput | AdminNotifyInput[] | null>) {
  after(async () => {
    try {
      const built = await build();
      const inputs = built ? (Array.isArray(built) ? built : [built]) : [];
      if (inputs.length === 0) return;

      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', deletedAt: null },
        select: { id: true },
      });

      await Promise.all(admins.flatMap((admin) => inputs.map((input) => saveNotification({ ...input, userId: admin.id }))));
    } catch (error) {
      console.error('Could not save admin notification:', error);
    }
  });
}

/** Maps seller ids to the user account that owns each one. */
export async function getSellerUserIds(sellerIds: string[]) {
  const sellers = await prisma.seller.findMany({
    where: { id: { in: [...new Set(sellerIds)] } },
    select: { id: true, userId: true },
  });

  return new Map(sellers.map((seller) => [seller.id, seller.userId]));
}

export function shortOrderId(orderId: string) {
  return orderId.slice(-8).toUpperCase();
}
