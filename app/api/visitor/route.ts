import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cleanPlace, parseStoreLocation } from '@/lib/locations';
import { getOrCreateVisitor, getVisitor } from '@/lib/visitor';

const MAX_POSTAL_CODE_LENGTH = 12;

/** What the site remembers about this browser: whether the first-visit location question was answered, and the location shared. */
export async function GET() {
  const visitor = await getVisitor();

  const hasLocation =
    visitor !== null && visitor.lastLatitude !== null && visitor.lastLongitude !== null && visitor.lastLocationLabel;

  return NextResponse.json({
    prompted: Boolean(visitor?.locationPromptedAt),
    location: hasLocation
      ? {
          label: visitor.lastLocationLabel,
          postalCode: visitor.lastPostalCode ?? '',
          lat: visitor.lastLatitude,
          lng: visitor.lastLongitude,
        }
      : null,
  });
}

/**
 * Records an answer: `prompted: true` once the first-visit question was answered or dismissed,
 * and/or `location` (the delivery location they shared or confirmed; null forgets it).
 */
export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const location = parseStoreLocation(body?.location);

  if (location === 'invalid') {
    return NextResponse.json({ error: 'That location is not valid.' }, { status: 400 });
  }

  const postalCode = cleanPlace(body?.location?.postalCode).slice(0, MAX_POSTAL_CODE_LENGTH);
  const visitor = await getOrCreateVisitor();

  await prisma.visitor.update({
    where: { id: visitor.id },
    data: {
      lastSeenAt: new Date(),
      ...(body?.prompted === true ? { locationPromptedAt: visitor.locationPromptedAt ?? new Date() } : {}),
      ...(location === undefined
        ? {}
        : {
            lastLatitude: location?.lat ?? null,
            lastLongitude: location?.lng ?? null,
            lastLocationLabel: location?.label ?? null,
            lastPostalCode: location ? postalCode || null : null,
          }),
    },
  });

  return NextResponse.json({ ok: true });
}
