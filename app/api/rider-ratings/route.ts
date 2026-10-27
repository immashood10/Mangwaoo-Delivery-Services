import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { ADMIN_PAGES } from '@/lib/notification-types';
import { notifyAdminsAfterResponse, notifyAfterResponse } from '@/lib/notify';
import { prisma } from '@/lib/prisma';
import { enforceRateLimits } from '@/lib/rate-limit';
import { MAX_COMPLAINT_LENGTH, MAX_RATING_COMMENT_LENGTH } from '@/lib/rider-history-types';
import { rateRiderOrder } from '@/lib/rider-orders';

/** A trimmed text, or null when it is empty or missing; undefined when it is not text or is too long. */
function readText(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return undefined;

  const text = value.trim();

  if (text.length > maxLength) return undefined;

  return text || null;
}

const snippet = (text: string, length: number) => (text.length > length ? `${text.slice(0, length).trimEnd()}…` : text);

/**
 * The customer rates the rider once their order was delivered: 1 to 5 stars, optionally a comment for the rider and a
 * complaint for Mangwaoo. The rider is told about the rating; the admins are told about a complaint (Admin > Rider
 * Reviews). The rider never sees the complaint's text. Customers only, and only for their own delivered orders.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session || session.role !== 'CUSTOMER') {
    return NextResponse.json({ error: 'Please log in as a customer to rate your rider.', requiresLogin: true }, { status: 401 });
  }

  const customer = await prisma.customer.findUnique({ where: { userId: session.userId }, select: { id: true } });

  if (!customer) {
    return NextResponse.json({ error: 'Customer account not found.' }, { status: 404 });
  }

  const limited = await enforceRateLimits([{ scope: 'rider-rating', subject: customer.id, limit: 20, windowSeconds: 3600 }]);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const chatId = typeof body?.chatId === 'string' ? body.chatId : '';
  const stars = typeof body?.stars === 'number' ? body.stars : NaN;
  const comment = readText(body?.comment, MAX_RATING_COMMENT_LENGTH);
  const complaint = readText(body?.complaint, MAX_COMPLAINT_LENGTH);

  if (!chatId) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return NextResponse.json({ error: 'Please choose 1 to 5 stars.' }, { status: 400 });
  }

  if (comment === undefined) {
    return NextResponse.json({ error: `Your comment can be at most ${MAX_RATING_COMMENT_LENGTH} characters.` }, { status: 400 });
  }

  if (complaint === undefined) {
    return NextResponse.json({ error: `Your complaint can be at most ${MAX_COMPLAINT_LENGTH} characters.` }, { status: 400 });
  }

  const result = await rateRiderOrder({ customerId: customer.id, chatId, stars, comment, complaint });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  notifyAfterResponse(async () => ({
    userId: result.riderUserId,
    type: 'ORDER' as const,
    title: 'New rating from a customer',
    message: `${result.customerName} rated your delivery ${stars} ${stars === 1 ? 'star' : 'stars'}.${comment ? ` "${snippet(comment, 100)}"` : ''}`,
    href: '/rider/history',
    refId: `rating:${chatId}`,
  }));

  if (complaint) {
    notifyAdminsAfterResponse(async () => ({
      type: 'MESSAGE' as const,
      title: 'Complaint about a rider',
      message: `${result.customerName} reported a problem with ${result.riderName}: "${snippet(complaint, 140)}"`,
      href: ADMIN_PAGES.riderReviews,
      refId: `complaint:${chatId}`,
    }));
  }

  return NextResponse.json({ ok: true, stars, complaintSent: complaint !== null }, { status: 201 });
}
