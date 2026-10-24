import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { refreshFoodCatalog, refreshMartCatalog } from '@/lib/catalog-cache';
import { DEFAULT_COUNTRY, MAX_PLACE_LENGTH, cleanPlace, parseStoreLocation } from '@/lib/locations';
import { parseCoverUpload } from '@/lib/seller-cover';

const MAX_STORE_NAME_LENGTH = 80;
const COVER_TRANSACTION = { timeout: 20000, maxWait: 10000 };

// Store name and location, as shown on the seller's public store page and ads, plus the
// pin on the map that food search uses to list the nearest restaurants first, plus (food
// sellers) the background picture of the restaurant.
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

  // Absent = keep the current background picture; null = remove it; a data URL = replace it.
  const cover = parseCoverUpload(body?.cover);

  if (cover === 'invalid') {
    return NextResponse.json({ error: 'The background picture must be a JPG, PNG or WebP picture of up to 2 MB.' }, { status: 400 });
  }

  const current = await prisma.seller.findUnique({ where: { userId: session.userId }, select: { id: true, sellerType: true } });

  if (!current) {
    return NextResponse.json({ error: 'Seller account not found.' }, { status: 404 });
  }

  if (cover !== undefined && current.sellerType === 'MART') {
    return NextResponse.json({ error: 'Only food businesses have a background picture.' }, { status: 400 });
  }

  const now = new Date();

  const seller = await prisma
    .$transaction(async (tx) => {
      if (cover === null) {
        await tx.sellerCover.deleteMany({ where: { sellerId: current.id } });
      } else if (cover) {
        await tx.sellerCover.upsert({
          where: { sellerId: current.id },
          create: { sellerId: current.id, ...cover },
          update: { ...cover, createdAt: now },
        });
      }

      return tx.seller.update({
        where: { id: current.id },
        data: {
          businessName,
          city: city || null,
          country,
          ...(location === undefined
            ? {}
            : { latitude: location?.lat ?? null, longitude: location?.lng ?? null, locationLabel: location?.label ?? null }),
          ...(cover === undefined ? {} : { coverUpdatedAt: cover ? now : null }),
        },
        select: { id: true, businessName: true, city: true, country: true, latitude: true, longitude: true, locationLabel: true },
      });
    }, COVER_TRANSACTION)
    .catch(() => null);

  if (!seller) {
    return NextResponse.json({ error: 'Could not save your store details. Please try again.' }, { status: 500 });
  }

  // Catalog pages show the store name next to every item, so refresh their cached copies.
  refreshMartCatalog();
  refreshFoodCatalog();

  return NextResponse.json({ seller });
}
