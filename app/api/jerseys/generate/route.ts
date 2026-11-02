import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientIp } from '@/lib/client-ip';
import { enforceRateLimits } from '@/lib/rate-limit';
import { JERSEY_PATTERN_LABELS, MAX_JERSEY_BASE_IMAGE_BYTES, parseJerseyFields } from '@/lib/jersey-config';
import { detectRasterImage } from '@/lib/image-signature';

export const runtime = 'nodejs';
export const maxDuration = 60;

const FALLBACK_IP = 'ip-unavailable';

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > 20_000) return NextResponse.json({ error: 'Jersey details are too large.' }, { status: 413 });

  const body = await request.json().catch(() => null);
  const parsed = parseJerseyFields(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const draftId = body && typeof body === 'object' && typeof body.draftId === 'string' ? body.draftId.slice(0, 32) : '';

  if (draftId) {
    const existing = await prisma.jerseyDesign.findUnique({ where: { id: draftId }, select: { id: true, status: true } });
    if (!existing || existing.status !== 'DRAFT') {
      return NextResponse.json({ error: 'This jersey draft is no longer available. Start a new design.' }, { status: 409 });
    }
  }

  const ip = clientIp(request) ?? FALLBACK_IP;
  const limited = await enforceRateLimits(
    [{ scope: 'jersey-generate-ip', subject: ip, limit: 5, windowSeconds: 60 * 60 }],
    'You have used today’s design generations. Please try again later.'
  );
  if (limited) return limited;

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: 'AI design generation is not configured yet. Please contact Mangwaoo.' }, { status: 503 });

  const fields = parsed.fields;
  const prompt = [
    'Create a high-quality seamless textile fabric swatch for a custom sports jersey, portrait 3:4 composition.',
    `Use this style: ${JERSEY_PATTERN_LABELS[fields.pattern]}.`,
    `Colour palette: primary ${fields.primaryColor}, secondary ${fields.secondaryColor}.`,
    'Show only a flat close-up textile surface, no garment, mannequin, person, badge, letters, words, numbers, logos, borders, labels, or watermark-like marks.',
    'The pattern should tile cleanly, have a professional sportswear knit texture, and keep the palette balanced so white and dark vector lettering can both be placed on top.',
  ].join(' ');

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.JERSEY_IMAGE_MODEL?.trim() || 'gemini-nano-banana-2.1',
      contents: prompt,
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: '3:4', imageSize: '1K' },
      },
    });

    const imagePart = response.candidates?.flatMap((candidate) => candidate.content?.parts ?? []).find((part) => part.inlineData?.data);
    const encoded = imagePart?.inlineData?.data;
    const imageBytes = encoded ? Buffer.from(encoded, 'base64') : null;
    const mimeType = imageBytes ? detectRasterImage(imageBytes) : null;

    if (!imageBytes || !mimeType || imageBytes.byteLength > MAX_JERSEY_BASE_IMAGE_BYTES) {
      return NextResponse.json({ error: 'The image model did not return a usable jersey pattern. Please generate again.' }, { status: 502 });
    }

    let design;
    if (draftId) {
      design = await prisma.jerseyDesign.update({
        where: { id: draftId },
        data: { ...fields, baseImage: imageBytes, baseImageType: mimeType, generatedAt: new Date() },
        select: { id: true },
      });
    } else {
      design = await prisma.jerseyDesign.create({
        data: { ...fields, baseImage: imageBytes, baseImageType: mimeType },
        select: { id: true },
      });
    }

    return NextResponse.json(
      { designId: design.id, baseImage: `data:${mimeType};base64,${imageBytes.toString('base64')}` },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.warn('[jersey-generate] Image generation failed', error instanceof Error ? error.name : 'unknown-error');
    return NextResponse.json({ error: 'Could not generate this jersey right now. Please try again.' }, { status: 502 });
  }
}
