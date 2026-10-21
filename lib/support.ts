import { prisma } from '@/lib/prisma';
import { MAX_SUPPORT_MESSAGE_LENGTH, type SupportMessageView, type SupportThreadSummary } from '@/lib/support-types';

const PREVIEW_LENGTH = 90;
const MAX_THREADS = 200;

export function toSupportMessageView(message: { id: string; fromAdmin: boolean; body: string; createdAt: Date }): SupportMessageView {
  return { id: message.id, fromAdmin: message.fromAdmin, body: message.body, createdAt: message.createdAt.toISOString() };
}

export function previewOf(text: string) {
  return text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH)}…` : text;
}

/** The text of a new message from a JSON body, or an error to send back. */
export function parseSupportBody(body: unknown): { text: string } | { error: string } {
  const text = typeof (body as { body?: unknown } | null)?.body === 'string' ? (body as { body: string }).body.trim() : '';

  if (!text) return { error: 'Message cannot be empty.' };
  if (text.length > MAX_SUPPORT_MESSAGE_LENGTH) return { error: 'Message is too long.' };

  return { text };
}

/** Whether this account can be written to: a live (not deleted), confirmed seller or rider. */
export async function findContactableUser(userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, role: { in: ['SELLER', 'RIDER'] }, deletedAt: null, phoneVerifiedAt: { not: null } },
    select: { id: true, name: true, role: true, seller: { select: { businessName: true } } },
  });
}

/** Every thread (newest activity first) with its last message and how many of the person's messages are unread. */
export async function getSupportThreadSummaries(userId?: string): Promise<SupportThreadSummary[]> {
  const threads = await prisma.supportThread.findMany({
    where: { ...(userId ? { userId } : {}), user: { deletedAt: null } },
    orderBy: { updatedAt: 'desc' },
    take: MAX_THREADS,
    select: {
      id: true,
      updatedAt: true,
      user: { select: { id: true, name: true, role: true, seller: { select: { businessName: true } } } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, fromAdmin: true } },
    },
  });

  const unread = await prisma.supportMessage.groupBy({
    by: ['threadId'],
    where: { threadId: { in: threads.map((thread) => thread.id) }, fromAdmin: false, isRead: false },
    _count: true,
  });
  const unreadByThread = new Map(unread.map((row) => [row.threadId, row._count]));

  return threads.map((thread) => ({
    id: thread.id,
    userId: thread.user.id,
    name: thread.user.name,
    role: thread.user.role === 'RIDER' ? 'RIDER' : 'SELLER',
    businessName: thread.user.seller?.businessName ?? null,
    lastMessage: thread.messages[0] ? previewOf(thread.messages[0].body) : null,
    lastFromAdmin: thread.messages[0]?.fromAdmin ?? null,
    updatedAt: thread.updatedAt.toISOString(),
    unreadCount: unreadByThread.get(thread.id) ?? 0,
  }));
}
