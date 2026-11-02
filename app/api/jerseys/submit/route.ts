import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientIp } from '@/lib/client-ip';
import { enforceRateLimits } from '@/lib/rate-limit';
import { detectRasterImage } from '@/lib/image-signature';
import {
  JERSEY_LOGO_PLACEMENTS,
  MAX_JERSEY_LOGO_BYTES,
  MAX_JERSEY_LOGO_TOTAL_BYTES,
  MAX_JERSEY_LOGOS,
  MAX_JERSEY_SUBMISSION_BYTES,
  parseJerseyFields,
  type JerseyLogoPlacementValue,
} from '@/lib/jersey-config';

export const runtime = 'nodejs';

class AlreadySubmittedError extends Error {}

type SponsorDetails = { name: string; placement: JerseyLogoPlacementValue };

function parseSponsors(value: FormDataEntryValue | null): SponsorDetails[] | null {
  if (typeof value !== 'string' || value.length > 8_000) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length > MAX_JERSEY_LOGOS) return null;
    const sponsors: SponsorDetails[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const sponsor = item as Record<string, unknown>;
      const name = typeof sponsor.name === 'string' ? sponsor.name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 48) : '';
      if (!JERSEY_LOGO_PLACEMENTS.includes(sponsor.placement as JerseyLogoPlacementValue)) return null;
      sponsors.push({ name, placement: sponsor.placement as JerseyLogoPlacementValue });
    }
    return sponsors;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_JERSEY_SUBMISSION_BYTES) {
    return NextResponse.json({ error: 'Sponsor files are too large. Keep the combined upload under 2 MB.' }, { status: 413 });
  }

  const limited = await enforceRateLimits(
    [{ scope: 'jersey-submit-ip', subject: clientIp(request) ?? 'ip-unavailable', limit: 10, windowSeconds: 24 * 60 * 60 }],
    'Too many jersey enquiries were sent. Please try again tomorrow.'
  );
  if (limited) return limited;

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Could not read the jersey submission.' }, { status: 400 });

  const designId = form.get('designId');
  if (typeof designId !== 'string' || !/^[a-zA-Z0-9_-]{12,32}$/.test(designId)) {
    return NextResponse.json({ error: 'Generate a jersey preview before submitting your enquiry.' }, { status: 400 });
  }

  const parsed = parseJerseyFields({
    customerName: form.get('customerName'),
    phone: form.get('phone'),
    playerName: form.get('playerName'),
    jerseyNumber: form.get('jerseyNumber'),
    teamName: form.get('teamName'),
    size: form.get('size'),
    primaryColor: form.get('primaryColor'),
    secondaryColor: form.get('secondaryColor'),
    pattern: form.get('pattern'),
    collar: form.get('collar'),
    sleeve: form.get('sleeve'),
  });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const sponsors = parseSponsors(form.get('sponsors'));
  if (!sponsors) return NextResponse.json({ error: 'One or more sponsor placements are invalid.' }, { status: 400 });
  const files = sponsors.map((_, index) => form.get(`logo_${index}`));
  let totalBytes = 0;
  const logoRecords: {
    sponsorName: string;
    placement: JerseyLogoPlacementValue;
    mimeType: string;
    size: number;
    data: Uint8Array<ArrayBuffer>;
  }[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    if (!(file instanceof File) || file.size === 0 || file.size > MAX_JERSEY_LOGO_BYTES) {
      return NextResponse.json({ error: `Sponsor logo ${index + 1} must be a JPG, PNG or WebP image under 500 KB.` }, { status: 400 });
    }

    totalBytes += file.size;
    if (totalBytes > MAX_JERSEY_LOGO_TOTAL_BYTES) {
      return NextResponse.json({ error: 'Keep all sponsor logos combined under 1.5 MB.' }, { status: 413 });
    }

    const data = new Uint8Array(file.size);
    data.set(new Uint8Array(await file.arrayBuffer()));
    const mimeType = detectRasterImage(data);
    if (!mimeType) return NextResponse.json({ error: `Sponsor logo ${index + 1} is not a valid JPG, PNG or WebP image.` }, { status: 400 });
    logoRecords.push({
      sponsorName: sponsors[index].name || `Sponsor ${index + 1}`,
      placement: sponsors[index].placement,
      mimeType,
      size: data.byteLength,
      data,
    });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.jerseyDesign.updateMany({
        where: { id: designId, status: 'DRAFT' },
        data: { ...parsed.fields, status: 'SUBMITTED', submittedAt: new Date() },
      });
      if (updated.count !== 1) throw new AlreadySubmittedError();

      await tx.jerseySponsorLogo.deleteMany({ where: { designId } });
      if (logoRecords.length) {
        await tx.jerseySponsorLogo.createMany({ data: logoRecords.map((logo) => ({ ...logo, designId })) });
      }
    });
  } catch (error) {
    if (error instanceof AlreadySubmittedError) {
      return NextResponse.json({ error: 'This jersey enquiry has already been sent.' }, { status: 409 });
    }
    console.error('[jersey-submit] Could not save a design submission', error instanceof Error ? error.name : 'unknown-error');
    return NextResponse.json({ error: 'Could not save your jersey enquiry. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, reference: designId.slice(-8).toUpperCase() }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
