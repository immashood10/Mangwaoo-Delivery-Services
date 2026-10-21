import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { refreshFoodCatalog, refreshMartCatalog } from '@/lib/catalog-cache';
import { DEFAULT_COUNTRY, MAX_PLACE_LENGTH, cleanPlace, parseStoreLocation } from '@/lib/locations';

const MAX_STORE_NAME_LENGTH = 80;

// Store name and location, as shown on the seller's public store page and ads, plus the
// pin on the map that food search uses to list the nearest restaurants first.
export async function PATCH(request: NextRequest) {
  const session = await getSession();

  if (!session || session.role !== 'SELLER') {
    return NextResponse.json({ error: 'You must be logged in as a seller to do this.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const businessName = cleanPlace(body?.businessName);
  const city = cleanPlace(body?.city);
  const country = cleanPlace(body?.country) || DEFAULT_COUNTRY;

  if (!businessName) {
    return NextResponse.json({ error: 'Please enter your store name.' }, { status: 400 });
  }

  if (businessName.length > MAX_STORE_NAME_LENGTH) {
    return NextResponse.json({ error: `Store name can be up to ${MAX_STORE_NAME_LENGTH} characters.` }, { status: 400 });
  }

  if (city.length > MAX_PLACE_LENGTH || country.length > MAX_PLACE_LENGTH) {
    return NextResponse.json({ error: `City and country can be up to ${MAX_PLACE_LENGTH} characters.` }, { status: 400 });
  }

  // Absent = keep the current pin; null = remove it.
  const location = parseStoreLocation(body?.location);

  if (location === 'invalid') {
    return NextResponse.json({ error: 'Please choose your location again from the suggestions.' }, { status: 400 });
  }

  const seller = await prisma.seller
    .update({
      where: { userId: session.userId },
      data: {
        businessName,
        city: city || null,
        country,
        ...(location === undefined
          ? {}
          : { latitude: location?.lat ?? null, longitude: location?.lng ?? null, locationLabel: location?.label ?? null }),
      },
      select: { id: true, businessName: true, city: true, country: true, latitude: true, longitude: true, locationLabel: true },
    })
    .catch(() => null);

  if (!seller) {
    return NextResponse.json({ error: 'Seller account not found.' }, { status: 404 });
  }

  // Catalog pages show the store name next to every item, so refresh their cached copies.
  refreshMartCatalog();
  refreshFoodCatalog();

  return NextResponse.json({ seller });
}
