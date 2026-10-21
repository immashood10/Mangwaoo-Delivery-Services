import { prisma } from '@/lib/prisma';
import type { NotificationCounts, NotificationKind, NotificationSnapshot } from '@/lib/notification-types';

const MAX_LISTED = 30;
const KEEP_SEEN_FOR_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Marks a person's notifications as seen — by id, by the page they belong to, or all of them — and returns
 * the new snapshot. Shared by the seller and admin bells (the table is keyed by account, whatever the role).
 * Returns null when the request names nothing.
 */
export async function markNotificationsSeen(userId: string, body: unknown): Promise<NotificationSnapshot | null> {
  const input = (body ?? {}) as { ids?: unknown; hrefs?: unknown; all?: unknown };
  const ids: string[] = Array.isArray(input.ids) ? input.ids.filter((id: unknown): id is string => typeof id === 'string') : [];
  const hrefs: string[] = Array.isArray(input.hrefs) ? input.hrefs.filter((href: unknown): href is string => typeof href === 'string') : [];
  const all = input.all === true;

  if (!all && ids.length === 0 && hrefs.length === 0) return null;

  await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
      ...(all
        ? {}
        : { OR: [...(ids.length ? [{ id: { in: ids } }] : []), ...(hrefs.length ? [{ href: { in: hrefs } }] : [])] }),
    },
    data: { isRead: true },
  });

  // Keep the table small: seen notifications are only useful for a little while.
  await prisma.notification.deleteMany({
    where: { userId, isRead: true, createdAt: { lt: new Date(Date.now() - KEEP_SEEN_FOR_MS) } },
  });

  return getSellerNotifications(userId);
}

/** A seller's unread notifications (newest first) plus unread counts per dashboard page. */
export async function getSellerNotifications(userId: string): Promise<NotificationSnapshot> {
  const [rows, groups] = await Promise.all([
    prisma.notification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: MAX_LISTED,
      select: { id: true, type: true, title: true, message: true, href: true, createdAt: true },
    }),
    prisma.notification.groupBy({ by: ['href'], where: { userId, isRead: false }, _count: true }),
  ]);

  const counts: NotificationCounts = {};
  for (const group of groups) {
    if (group.href) counts[group.href] = group._count;
  }

  return {
    items: rows.map((row) => ({
      id: row.id,
      type: row.type as NotificationKind,
      title: row.title,
      message: row.message,
      href: row.href,
      createdAt: row.createdAt.toISOString(),
    })),
    counts,
  };
}
