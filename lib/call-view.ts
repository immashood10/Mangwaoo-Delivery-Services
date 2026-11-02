import type { InAppCall } from '@/lib/generated/prisma/client';

export function callView(call: InAppCall, viewerUserId: string) {
  return {
    id: call.id,
    callerName: call.callerName,
    receiverName: call.receiverName,
    status: call.status,
    recordingStatus: call.recordingStatus,
    createdAt: call.createdAt.toISOString(),
    startedAt: call.startedAt?.toISOString() ?? null,
    endedAt: call.endedAt?.toISOString() ?? null,
    isCaller: call.callerUserId === viewerUserId,
  };
}
