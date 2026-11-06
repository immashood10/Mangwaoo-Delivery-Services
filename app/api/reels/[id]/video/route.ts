import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { videoRange } from '@/lib/reel-config';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const session = await getSession();
  const reel = await prisma.reel.findFirst({ where: { id, author: { isActive: true, deletedAt: null }, ...(session?.role === 'ADMIN' ? {} : { OR: [{ status: 'APPROVED' }, ...(session ? [{ authorId: session.userId }] : [])] }) }, select: { video: { select: { mimeType: true, size: true, data: true } } } });
  if (!reel?.video) return new Response(null, { status: 404 });
  const video = reel.video; const range = videoRange(request.headers.get('range'), video.size);
  if (!range) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + video.size } });
  const bytes = Uint8Array.from(video.data.subarray(range.start, range.end + 1));
  return new Response(bytes.buffer, { status: range.partial ? 206 : 200, headers: { 'Content-Type': video.mimeType, 'Content-Length': String(bytes.length), 'Accept-Ranges': 'bytes', ...(range.partial ? { 'Content-Range': 'bytes ' + range.start + '-' + range.end + '/' + video.size } : {}), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline', 'Content-Security-Policy': "default-src 'none'; sandbox" } });
}
