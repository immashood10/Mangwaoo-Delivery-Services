import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveRiderChatAccess } from '@/lib/rider-chat';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await resolveRiderChatAccess(id);
  if ('error' in access) return access.error;

  // Riders can only close chats they have claimed, not open requests.
  if (access.role === 'RIDER' && access.chat.riderId !== access.riderId) {
    return NextResponse.json({ error: 'Reply first to take this order.' }, { status: 403 });
  }

  await prisma.riderChat.update({ where: { id }, data: { status: 'CLOSED' } });

  return NextResponse.json({ ok: true });
}
