import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

/** Permanently deletes an order chat and all of its messages. Admin only. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 });
  }

  const { id } = await params;
  const chat = await prisma.riderChat.findUnique({ where: { id }, select: { id: true } });

  if (!chat) {
    return NextResponse.json({ error: 'Chat not found.' }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.riderChatMessage.deleteMany({ where: { chatId: id } }),
    prisma.riderChatAttachment.deleteMany({ where: { chatId: id } }),
    prisma.riderChat.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
