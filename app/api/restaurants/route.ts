import { NextRequest, NextResponse } from 'next/server';
import { parseCoordinates } from '@/lib/geo';
import { getRestaurantCards } from '@/lib/restaurant-cards';

// The home page's restaurant cards in the order for one delivery address: nearest first, each with its
// distance. The distance is worked out here so the kitchens' own coordinates never reach the browser.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = parseCoordinates(searchParams.get('lat') ?? undefined, searchParams.get('lng') ?? undefined);

  if (!origin) {
    return NextResponse.json({ error: 'Send a valid lat and lng.' }, { status: 400 });
  }

  return NextResponse.json(
    { restaurants: await getRestaurantCards(origin) },
    // It depends on where the customer is, so it is not for shared caches.
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
