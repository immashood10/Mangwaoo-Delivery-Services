import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRiderChatSummary, resolveRiderChatAccess, serializeRiderChatMessage } from '@/lib/rider-chat';
import { chatDispatchPoint, getOnlineRiders, ridersForLocation } from '@/lib/rider-dispatch';

export const dynamic = 'force-dynamic';

// Each tick is one parallel round trip (~300 ms to the remote DB) plus this pause.
const CHECK_INTERVAL_MS = 700;
const NEARBY_RIDERS_INTERVAL_MS = 5000;
const HEARTBEAT_INTERVAL_MS = 15000;
// Recycle long-lived connections; EventSource reconnects on its own and resumes via Last-Event-ID.
const MAX_STREAM_MS = 4 * 60 * 1000;

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

/**
 * Server-Sent Events feed for one chat: pushes new messages and chat status
 * changes within ~1s, so clients don't have to poll.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await resolveRiderChatAccess(id);
  if ('error' in access) return access.error;

  const resumeFrom = request.headers.get('last-event-id') ?? request.nextUrl.searchParams.get('since');
  let since = resumeFrom && !Number.isNaN(Date.parse(resumeFrom)) ? new Date(resumeFrom) : null;

  const encoder = new TextEncoder();
  const signal = request.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Client already gone.
        }
      };
      const send = (event: string, data: unknown, eventId?: string) =>
        write(`${eventId ? `id: ${eventId}\n` : ''}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      // Messages created in the same millisecond as `since` are re-read with
      // `gte`; this set stops them being sent twice.
      const sentAtSince = new Set<string>();
      let lastChatJson = '';
      let lastStateKey = '';
      let summary: Awaited<ReturnType<typeof getRiderChatSummary>> = null;
      let nearbyRiderCount = 0;
      let lastNearbyCheck = 0;
      let lastWrite = Date.now();
      const startedAt = Date.now();

      write('retry: 2000\n\n');

      try {
        while (!signal.aborted && Date.now() - startedAt < MAX_STREAM_MS) {
          // One parallel round trip per tick: the chat's state columns + any new messages.
          const [chat, messages] = await Promise.all([
            prisma.riderChat.findUnique({
              where: { id },
              select: {
                status: true,
                riderId: true,
                latitude: true,
                longitude: true,
                pickupLatitude: true,
                pickupLongitude: true,
              },
            }),
            prisma.riderChatMessage.findMany({
              where: { chatId: id, ...(since ? { createdAt: { gte: since } } : {}) },
              orderBy: { createdAt: 'asc' },
            }),
          ]);

          if (!chat) {
            send('missing', { error: 'This chat was removed.' });
            break;
          }

          if (access.role === 'RIDER' && chat.riderId && chat.riderId !== access.riderId) {
            send('forbidden', { error: 'Another rider has already taken this order.' });
            break;
          }

          const fresh = messages.filter((message) => !sentAtSince.has(message.id));
          if (fresh.length > 0) {
            const newest = fresh[fresh.length - 1].createdAt;
            if (!since || newest.getTime() !== since.getTime()) sentAtSince.clear();
            since = newest;
            for (const message of messages) {
              if (message.createdAt.getTime() === newest.getTime()) sentAtSince.add(message.id);
            }
            send('messages', fresh.map(serializeRiderChatMessage), newest.toISOString());
            lastWrite = Date.now();
          }

          if (chat.status === 'OPEN' && Date.now() - lastNearbyCheck > NEARBY_RIDERS_INTERVAL_MS) {
            nearbyRiderCount = ridersForLocation(chatDispatchPoint(chat), await getOnlineRiders()).length;
            lastNearbyCheck = Date.now();
          }

          // Names/address only change when the status or rider does, so the
          // heavier summary read happens only then.
          const stateKey = `${chat.status}:${chat.riderId ?? ''}`;
          if (stateKey !== lastStateKey || !summary) {
            summary = await getRiderChatSummary(id);
            lastStateKey = stateKey;
          }
          if (!summary) {
            send('missing', { error: 'This chat was removed.' });
            break;
          }

          const chatJson = JSON.stringify({
            ...summary,
            nearbyRiderCount: chat.status === 'OPEN' ? nearbyRiderCount : 0,
          });
          if (chatJson !== lastChatJson) {
            lastChatJson = chatJson;
            write(`event: chat\ndata: ${chatJson}\n\n`);
            lastWrite = Date.now();
          }

          if (Date.now() - lastWrite > HEARTBEAT_INTERVAL_MS) {
            write(': ping\n\n');
            lastWrite = Date.now();
          }

          await wait(CHECK_INTERVAL_MS, signal);
        }
      } catch {
        // DB hiccup — close and let EventSource reconnect.
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
