import { AccessToken, EgressClient, RoomServiceClient } from 'livekit-server-sdk';
import { EncodedFileOutput, EncodedFileType, S3Upload } from 'livekit-server-sdk';
import { prisma } from '@/lib/prisma';

function config() {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const bucket = process.env.CALL_RECORDINGS_S3_BUCKET;
  const region = process.env.CALL_RECORDINGS_S3_REGION;
  const accessKey = process.env.CALL_RECORDINGS_S3_ACCESS_KEY;
  const secret = process.env.CALL_RECORDINGS_S3_SECRET;
  if (!url || !apiKey || !apiSecret || !bucket || !region || !accessKey || !secret) {
    throw new Error('In-app calls are not configured. Set LiveKit and private recording storage credentials.');
  }
  const apiUrl = url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
  return { url, apiUrl, apiKey, apiSecret, bucket, region, accessKey, secret, endpoint: process.env.CALL_RECORDINGS_S3_ENDPOINT };
}

export function callsConfigured() {
  try { config(); return true; } catch { return false; }
}

export function liveKitServices() {
  const env = config();
  return {
    env,
    rooms: new RoomServiceClient(env.apiUrl, env.apiKey, env.apiSecret),
    egress: new EgressClient(env.apiUrl, env.apiKey, env.apiSecret),
  };
}

export async function callToken(input: { userId: string; name: string; roomName: string }) {
  const { env } = liveKitServices();
  const token = new AccessToken(env.apiKey, env.apiSecret, { identity: input.userId, name: input.name, ttl: '2m' });
  token.addGrant({ roomJoin: true, room: input.roomName, canPublish: true, canSubscribe: true, canPublishData: false });
  return { serverUrl: env.url, token: await token.toJwt() };
}

/** Start audio-only recording only after both named participants have joined the consented call. */
export async function ensureCallRecording(callId: string) {
  const call = await prisma.inAppCall.findUnique({ where: { id: callId } });
  if (!call || call.status !== 'ACTIVE' || !call.receiverConsentedAt || call.recordingStatus === 'FAILED') return call;
  const { rooms, egress, env } = liveKitServices();
  let participants;
  try { participants = await rooms.listParticipants(call.roomName); } catch { return call; }
  const joined = new Set(participants.map((participant) => participant.identity));

  if (call.egressId) {
    if (joined.has(call.callerUserId) && joined.has(call.receiverUserId)) {
      if (call.disconnectedAt) await prisma.inAppCall.updateMany({ where: { id: call.id, status: 'ACTIVE', disconnectedAt: { not: null } }, data: { disconnectedAt: null } });
      return call;
    }
    if (!call.disconnectedAt) {
      await prisma.inAppCall.updateMany({ where: { id: call.id, status: 'ACTIVE', disconnectedAt: null }, data: { disconnectedAt: new Date() } });
      return call;
    }
    if (Date.now() - call.disconnectedAt.getTime() < 12000) return call;
    const ended = await prisma.inAppCall.updateMany({ where: { id: call.id, status: 'ACTIVE', disconnectedAt: { lte: new Date(Date.now() - 12000) } }, data: { status: 'ENDED', endedAt: new Date(), recordingStatus: 'PROCESSING' } });
    if (ended.count) {
      await egress.stopEgress(call.egressId).catch(() => undefined);
      await rooms.deleteRoom(call.roomName).catch(() => undefined);
    }
    return prisma.inAppCall.findUnique({ where: { id: call.id } });
  }

  if (Date.now() - call.createdAt.getTime() > 120000) {
    await prisma.inAppCall.updateMany({ where: { id: call.id, status: 'ACTIVE', egressId: null }, data: { status: 'ENDED', endedAt: new Date() } });
    await rooms.deleteRoom(call.roomName).catch(() => undefined);
    return prisma.inAppCall.findUnique({ where: { id: call.id } });
  }

  if (!joined.has(call.callerUserId) || !joined.has(call.receiverUserId)) return call;

  const claimed = await prisma.inAppCall.updateMany({ where: { id: call.id, status: 'ACTIVE', egressId: null, recordingStatus: 'PENDING' }, data: { recordingStatus: 'STARTING', startedAt: call.startedAt ?? new Date() } });
  if (!claimed.count) return prisma.inAppCall.findUnique({ where: { id: call.id } });

  const recordingObjectKey = `calls/${call.id}.mp4`;
  const output = new EncodedFileOutput({
    filepath: recordingObjectKey,
    fileType: EncodedFileType.MP4,
    output: {
      case: 's3',
      value: new S3Upload({
        bucket: env.bucket,
        region: env.region,
        accessKey: env.accessKey,
        secret: env.secret,
        endpoint: env.endpoint,
        forcePathStyle: Boolean(env.endpoint),
      }),
    },
  });

  try {
    const info = await egress.startRoomCompositeEgress(call.roomName, output, { audioOnly: true });
    return prisma.inAppCall.update({ where: { id: call.id }, data: { egressId: info.egressId, recordingObjectKey, recordingStatus: 'RECORDING' } });
  } catch (error) {
    await prisma.inAppCall.update({ where: { id: call.id }, data: { recordingStatus: 'FAILED', status: 'ENDED', endedAt: new Date() } });
    await Promise.allSettled(participants.map((participant) => rooms.removeParticipant(call.roomName, participant.identity)));
    throw error;
  }
}

export async function stopCallRecording(callId: string) {
  const call = await prisma.inAppCall.findUnique({ where: { id: callId } });
  if (!call?.egressId) return;
  try {
    const { egress } = liveKitServices();
    await egress.stopEgress(call.egressId);
    await prisma.inAppCall.updateMany({ where: { id: callId, recordingStatus: 'RECORDING' }, data: { recordingStatus: 'PROCESSING' } });
  } catch {
    // It may already have stopped because the room ended; the admin download route checks object availability.
    await prisma.inAppCall.updateMany({ where: { id: callId, recordingStatus: 'RECORDING' }, data: { recordingStatus: 'PROCESSING' } });
  }
}
