import { prisma } from '@/lib/prisma';

export type ChatTypingKind = 'CONVERSATION' | 'RIDER_CHAT';

export async function setChatTyping(input: {
  kind: ChatTypingKind;
  targetId: string;
  userId: string;
  senderRole: string;
  senderName: string;
  typing: boolean;
}) {
  const where = { kind_targetId_userId: { kind: input.kind, targetId: input.targetId, userId: input.userId } };
  if (!input.typing) {
    await prisma.chatTypingIndicator.deleteMany({ where: { kind: input.kind, targetId: input.targetId, userId: input.userId } });
    return;
  }
  await prisma.chatTypingIndicator.upsert({
    where,
    create: { ...input, expiresAt: new Date(Date.now() + 7000) },
    update: { senderRole: input.senderRole, senderName: input.senderName, expiresAt: new Date(Date.now() + 7000) },
  });
}

export async function getChatTyping(kind: ChatTypingKind, targetId: string, exceptUserId: string) {
  const now = new Date();
  const rows = await prisma.chatTypingIndicator.findMany({
    where: { kind, targetId, userId: { not: exceptUserId }, expiresAt: { gt: now } },
    select: { userId: true, senderRole: true, senderName: true },
  });
  return rows;
}
