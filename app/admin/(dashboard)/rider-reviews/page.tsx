import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Star } from 'lucide-react';
import AdminRiderReviews, { type RiderReviewRow } from '@/components/AdminRiderReviews';
import AutoRefresh from '@/components/AutoRefresh';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatRatingAverage } from '@/lib/rider-history-types';
import { getRiderRatings } from '@/lib/rider-orders';

export const metadata = {
  title: 'Rider Reviews - Mangwaoo Admin',
};

const VIEWS = ['complaints', 'all-complaints', 'ratings'] as const;
type View = (typeof VIEWS)[number];

const MAX_REVIEWS = 100;

export default async function AdminRiderReviewsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    redirect('/admin/login');
  }

  const { view } = await searchParams;

  const [openComplaints, allComplaints, ratingCount, overall] = await Promise.all([
    prisma.riderOrderRecord.count({ where: { complaint: { not: null }, complaintResolvedAt: null } }),
    prisma.riderOrderRecord.count({ where: { complaint: { not: null } } }),
    prisma.riderOrderRecord.count({ where: { stars: { not: null } } }),
    prisma.riderOrderRecord.aggregate({ where: { stars: { not: null } }, _avg: { stars: true } }),
  ]);

  // Open complaints are what needs doing, so they are what opens first (when there are none, the ratings do). The tab goes
  // into the address, so working through the complaints keeps you on the list instead of jumping to the ratings when the
  // last one is done.
  if (!(VIEWS as readonly string[]).includes(view ?? '')) {
    redirect(`/admin/rider-reviews?view=${openComplaints > 0 ? 'complaints' : 'ratings'}`);
  }

  const selected = view as View;
  const where =
    selected === 'complaints'
      ? { complaint: { not: null }, complaintResolvedAt: null }
      : selected === 'all-complaints'
        ? { complaint: { not: null } }
        : { stars: { not: null } };

  const records = await prisma.riderOrderRecord.findMany({
    where,
    orderBy: { ratedAt: 'desc' },
    take: MAX_REVIEWS,
    include: { rider: { select: { userId: true, user: { select: { name: true } } } } },
  });
  const ratings = await getRiderRatings(records.map((record) => record.riderId));

  const rows: RiderReviewRow[] = records.flatMap((record) =>
    record.stars !== null && record.ratedAt
      ? [
          {
            id: record.id,
            riderUserId: record.rider.userId,
            riderName: record.rider.user.name,
            riderRating: ratings.get(record.riderId) ?? null,
            customerName: record.customerName,
            stars: record.stars,
            comment: record.ratingComment,
            complaint: record.complaint,
            resolvedAt: record.complaintResolvedAt?.toISOString() ?? null,
            ratedAt: record.ratedAt.toISOString(),
            pickupText: record.pickupText,
            addressText: record.addressText,
            deliveryCharge: record.deliveryCharge,
          },
        ]
      : []
  );

  const tabs: { id: View; label: string; count: number }[] = [
    { id: 'complaints', label: 'Open complaints', count: openComplaints },
    { id: 'all-complaints', label: 'All complaints', count: allComplaints },
    { id: 'ratings', label: 'All ratings', count: ratingCount },
  ];
  const emptyText =
    selected === 'complaints'
      ? 'No open complaints. When a customer reports a problem with a rider it appears here.'
      : selected === 'all-complaints'
        ? 'No customer has complained about a rider yet.'
        : 'No customer has rated a rider yet.';

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <AutoRefresh />
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-red-primary/10 px-4 py-2 text-sm font-semibold text-accent">
        <Star className="h-4 w-4" />
        Admin
      </div>
      <h1 className="mb-2 text-3xl font-bold text-ink">Rider Reviews</h1>
      <p className="mb-6 text-brand-gray">
        After a delivery, customers rate their rider and can write a complaint. The rider sees the stars and the comment, never the complaint.
        {overall._avg.stars !== null ? ` Average rating of all riders: ${formatRatingAverage(Math.round(overall._avg.stars * 10) / 10)} from ${ratingCount} ratings.` : ''}
      </p>

      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="What to show">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={`/admin/rider-reviews?view=${tab.id}`}
            aria-current={selected === tab.id ? 'page' : undefined}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              selected === tab.id ? 'bg-brand-dark text-white' : 'bg-surface text-ink shadow-soft hover:text-accent'
            }`}
          >
            {tab.label}
            <span className={`rounded-full px-2 py-0.5 text-xs ${selected === tab.id ? 'bg-white/20' : 'bg-brand-light text-brand-gray'}`}>{tab.count}</span>
          </Link>
        ))}
      </div>

      <AdminRiderReviews reviews={rows} emptyText={emptyText} />

      {rows.length === MAX_REVIEWS ? <p className="mt-4 text-xs text-brand-gray">Showing the newest {MAX_REVIEWS}.</p> : null}
    </div>
  );
}
