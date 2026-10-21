import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { MAX_ADDRESS_LABEL_LENGTH } from '@/lib/saved-addresses';

const MAX_SAVED_ADDRESSES = 20;

function toSavedAddress(address: {
  id: string;
  label: string | null;
  street: string;
  latitude: number | null;
  longitude: number | null;
}) {
  return {
    id: address.id,
    label: address.label ?? 'Other',
    street: address.street,
    lat: address.latitude ?? 0,
    lng: address.longitude ?? 0,
  };
}

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Please log in to view saved addresses.' }, { status: 401 });
  }

  const addresses = await prisma.address.findMany({
    where: { userId: session.userId, isSaved: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ addresses: addresses.map(toSavedAddress) });
}

export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Please log in to save addresses.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  const label = typeof body?.label === 'string' ? body.label.trim().slice(0, MAX_ADDRESS_LABEL_LENGTH) : '';
  const street = typeof body?.street === 'string' ? body.street.trim() : '';
  const lat = typeof body?.lat === 'number' ? body.lat : NaN;
  const lng = typeof body?.lng === 'number' ? body.lng : NaN;

  if (!label || !street || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'Please provide a label and a valid location.' }, { status: 400 });
  }

  const savedCount = await prisma.address.count({ where: { userId: session.userId, isSaved: true } });

  if (savedCount >= MAX_SAVED_ADDRESSES) {
    return NextResponse.json(
      { error: `You can save up to ${MAX_SAVED_ADDRESSES} addresses. Remove one to add another.` },
      { status: 400 }
    );
  }

  const address = await prisma.address.create({
    data: {
      userId: session.userId,
      label,
      street,
      city: 'Karachi',
      latitude: lat,
      longitude: lng,
      isSaved: true,
    },
  });

  return NextResponse.json({ address: toSavedAddress(address) }, { status: 201 });
}
