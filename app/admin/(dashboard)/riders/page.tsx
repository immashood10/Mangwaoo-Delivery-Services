import { redirect } from 'next/navigation';
import { Bike } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RIDER_ONLINE_WINDOW_MS } from '@/lib/rider-dispatch';
import { RIDER_DOCUMENT_KINDS, getMissingRiderRequirements } from '@/lib/rider-documents';
import AdminRiderApprovals from '@/components/AdminRiderApprovals';
import AutoRefresh from '@/components/AutoRefresh';

export const metadata = {
  title: 'Rider Approvals - Mangwaoo Admin',
};

export default async function AdminRidersPage() {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    redirect('/admin/login');
  }

  const riders = await prisma.rider.findMany({
    // Riders who haven't confirmed their WhatsApp number are unfinished signups, and deleted accounts are gone.
    where: { user: { phoneVerifiedAt: { not: null }, deletedAt: null } },
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      // Which photos exist is enough here: the bytes are loaded one by one by the admin-only photo route.
      documents: { select: { kind: true } },
    },
  });

  // eslint-disable-next-line react-hooks/purity -- server component, rendered per request
  const onlineSince = Date.now() - RIDER_ONLINE_WINDOW_MS;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <AutoRefresh />
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-red-primary/10 px-4 py-2 text-sm font-semibold text-accent">
        <Bike className="h-4 w-4" />
        Admin
      </div>
      <h1 className="mb-2 text-3xl font-bold text-ink">Rider Approvals</h1>
      <p className="mb-8 text-brand-gray">
        Riders only receive customer order chats once approved here. Check each rider&apos;s CNIC photos, face photo and
        number plate first; a rider can&apos;t be approved until the CNIC (number and both photos), a face photo and the
        number plate are on file.
      </p>

      <AdminRiderApprovals
        riders={riders.map((rider) => ({
          id: rider.id,
          userId: rider.user.id,
          name: rider.user.name,
          email: rider.user.email,
          phone: rider.user.phone,
          vehicleType: rider.vehicleType,
          numberPlate: rider.numberPlate,
          cnicNumber: rider.cnicNumber,
          isApproved: rider.isApproved,
          isOnline: rider.isApproved && rider.isAvailable && rider.lastSeenAt !== null && rider.lastSeenAt.getTime() >= onlineSince,
          createdAt: rider.createdAt.toISOString(),
          documents: rider.documents.map((document) => document.kind).filter((kind) => (RIDER_DOCUMENT_KINDS as readonly string[]).includes(kind)),
          missing: getMissingRiderRequirements({
            vehicleType: rider.vehicleType,
            numberPlate: rider.numberPlate,
            cnicNumber: rider.cnicNumber,
            documentKinds: rider.documents.map((document) => document.kind),
          }),
        }))}
      />
    </div>
  );
}
