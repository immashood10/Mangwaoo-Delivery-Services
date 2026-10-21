import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveRiderChatAccess } from '@/lib/rider-chat';

/** Streams a chat photo / voice note from the database to a chat participant. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { id, attachmentId } = await params;
  const access = await resolveRiderChatAccess(id);
  if ('error' in access) return access.error;

  const attachment = await prisma.riderChatAttachment.findUnique({ where: { id: attachmentId } });

  if (!attachment || attachment.chatId !== id) {
    return NextResponse.json({ error: 'File not found.' }, { status: 404 });
  }

  return new Response(Buffer.from(attachment.data), {
    headers: {
      'Content-Type': attachment.mimeType,
      'Content-Length': String(attachment.size),
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      // Attachments never change once sent, but they are private to the chat.
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}
