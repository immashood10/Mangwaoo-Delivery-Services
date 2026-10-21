import { prisma } from '@/lib/prisma';

/** The photo of a live story. Gone (404) once the story expires or the admin removes it. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const story = await prisma.story.findFirst({
    where: { id, kind: 'IMAGE', expiresAt: { gt: new Date() } },
    select: { data: true, mimeType: true },
  });

  if (!story?.data || !story.mimeType) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(Buffer.from(story.data), {
    headers: {
      'Content-Type': story.mimeType,
      'Content-Length': String(story.data.length),
      'Cache-Control': 'public, max-age=600',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}
