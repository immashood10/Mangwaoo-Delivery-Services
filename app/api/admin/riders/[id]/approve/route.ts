import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { notifyAfterResponse } from '@/lib/notify';
import { getMissingRiderRequirements } from '@/lib/rider-documents';

// The admin approves a rider (or takes the approval back). An approved rider can go online and receive order chats.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const isApproved = typeof body?.isApproved === 'boolean' ? body.isApproved : true;

  // Only which photos exist is needed, never their bytes.
  const rider = await prisma.rider.findUnique({
    where: { id },
    include: {
      documents: { select: { kind: true } },
      user: { select: { id: true, phoneVerifiedAt: true, deletedAt: true } },
    },
  });

  if (!rider || rider.user.deletedAt) {
    return NextResponse.json({ error: 'Rider not found.' }, { status: 404 });
  }

  // A rider can only be approved once the CNIC (number and both photos) and number plate are on file,
  // and the WhatsApp number was confirmed with a code.
  if (isApproved) {
    if (!rider.user.phoneVerifiedAt) {
      return NextResponse.json({ error: "This rider hasn't confirmed their WhatsApp number yet." }, { status: 400 });
    }

    const missing = getMissingRiderRequirements({
      vehicleType: rider.vehicleType,
      numberPlate: rider.numberPlate,
      cnicNumber: rider.cnicNumber,
      documentKinds: rider.documents.map((document) => document.kind),
    });

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `This rider can't be approved yet. Missing: ${missing.join(', ')}.` },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.rider.update({
    where: { id },
    // Taking the approval back also sends the rider offline, so they stop receiving requests at once.
    data: isApproved ? { isApproved } : { isApproved, isAvailable: false },
  });

  if (rider.isApproved !== isApproved) {
    notifyAfterResponse(async () => ({
      userId: rider.user.id,
      type: 'ACCOUNT' as const,
      title: isApproved ? 'Rider account approved' : 'Rider approval removed',
      message: isApproved
        ? 'Your rider account was approved. Open the rider dashboard, go online and start receiving orders.'
        : 'Your rider approval was removed by the Mangwaoo team. Please contact support.',
      href: '/rider',
      refId: `rider-approval:${id}`,
    }));
  }

  return NextResponse.json({ rider: { id: updated.id, isApproved: updated.isApproved } });
}
