import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Flag, MapPin } from 'lucide-react';
import RiderRatingForm from '@/components/RiderRatingForm';
import StarRating, { RiderRatingLabel } from '@/components/StarRating';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getRiderRatings, reconcileOrderRecords } from '@/lib/rider-orders';

export const metadata = {
  title: 'Rate your rider - Mangwaoo',
};

/**
 * Rate the rider of a delivered order. This is where the "Order delivered" notification leads, and the page keeps
 * working after the order chat is gone. Only the customer the order belongs to can open it.
 */
export default async function RateRiderPage({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params;
  const session = await getSession();

  if (!session || session.role !== 'CUSTOMER') {
    redirect(`/login?next=/rate-rider/${chatId}`);
  }

  const customer = await prisma.customer.findUnique({ where: { userId: session.userId }, select: { id: true } });

  if (!customer) {
    notFound();
  }

  // An order that finished before ratings existed gets its history line now.
  await reconcileOrderRecords(prisma, { chatId });

  const record = await prisma.riderOrderRecord.findUnique({
    where: { chatId },
    include: { rider: { select: { id: true, user: { select: { name: true } } } } },
  });

  // Same answer for "no such order" and "not yours", so ids can't be probed. An order still going goes back to its chat.
  if (!record || record.customerId !== customer.id) {
    const chat = await prisma.riderChat.findUnique({ where: { id: chatId }, select: { customerId: true, status: true } });

    if (chat && chat.customerId === customer.id && chat.status !== 'CLOSED') {
      redirect(`/finding-rider/${chatId}`);
    }

    notFound();
  }

  const riderName = record.rider.user.name;
  const rating = (await getRiderRatings([record.riderId])).get(record.riderId) ?? null;

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6 md:py-14">
      <h1 className="mb-6 text-2xl font-bold text-ink md:text-3xl">Rate your rider</h1>

      <div className="mb-6 rounded-2xl bg-surface p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-red-primary/10 text-lg font-bold text-accent">
            {riderName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-bold text-ink">{riderName}</p>
            <RiderRatingLabel rating={rating} />
          </div>
        </div>

        <div className="mt-4 space-y-1 border-t border-gray-100 pt-4 text-sm text-brand-gray">
          <p className="text-xs">{record.endedAt.toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Karachi' })}</p>
          {record.pickupText ? (
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
              <span className="min-w-0 break-words">{record.pickupText}</span>
            </p>
          ) : null}
          <p className="flex items-start gap-2">
            <Flag className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            <span className="min-w-0 break-words">{record.addressText}</span>
          </p>
        </div>
      </div>

      {record.status !== 'DELIVERED' ? (
        <p className="rounded-2xl bg-surface p-5 text-center text-sm text-brand-gray shadow-soft">
          This order wasn&apos;t delivered, so there is nothing to rate.
        </p>
      ) : record.stars !== null ? (
        <div className="rounded-2xl bg-surface p-5 text-center shadow-soft">
          <p className="font-bold text-ink">You rated {riderName}</p>
          <div className="mt-2 flex justify-center">
            <StarRating value={record.stars} className="h-7 w-7" />
          </div>
          {record.ratingComment ? <p className="mt-2 break-words text-sm text-brand-gray">&ldquo;{record.ratingComment}&rdquo;</p> : null}
          {record.complaint ? <p className="mt-2 text-sm text-brand-gray">Your complaint was sent to Mangwaoo.</p> : null}
        </div>
      ) : (
        <RiderRatingForm chatId={chatId} riderName={riderName} />
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
        <Link href="/gulplaza" className="font-semibold text-accent hover:underline">
          Order more food
        </Link>
        <span className="text-gray-300">·</span>
        <Link href="/account" className="font-semibold text-accent hover:underline">
          My orders
        </Link>
      </div>
    </div>
  );
}
