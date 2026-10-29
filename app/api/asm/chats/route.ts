import { NextResponse } from 'next/server';
import { listManagerChats, requireManager } from '@/lib/area-managers';

/**
 * The order chats of the manager's own area: the ones waiting for a rider, the ones with a rider, and those finished in the
 * last day. Polled by the manager's screen every few seconds.
 */
export async function GET() {
  const auth = await requireManager();
  if ('error' in auth) return auth.error;

  const { manager } = auth;

  return NextResponse.json(
    { area: { id: manager.areaId, name: manager.areaName }, chats: await listManagerChats(manager.areaId) },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
