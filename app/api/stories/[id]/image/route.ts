import { prisma } from '@/lib/prisma';
import { getCurrentMarketingAudience, matchesMarketingAudience } from '@/lib/marketing-audience';

/** The photo of a live story. Gone (404) once the story expires or the admin removes it. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const story = await prisma.story.findFirst({
    where: { id, kind: 'IMAGE', expiresAt: { gt: new Date() } },
    select: {
      data: true,
      mimeType: true,
      ad: { select: { targetAgeMin: true, targetAgeMax: true, targetGender: true } },
    },
  });

  if (!story?.data || !story.mimeType) {
    return new Response('Not found', { status: 404 });
  }

  const audience = await getCurrentMarketingAudience();
  const target = story.ad ?? { targetAgeMin: null, targetAgeMax: null, targetGender: null };
  if (!matchesMarketingAudience(target, audience)) return new Response('Not found', { status: 404 });

  return new Response(Buffer.from(story.data), {
    headers: {
      'Content-Type': story.mimeType,
      'Content-Length': String(story.data.length),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}
