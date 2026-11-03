import { notifyAfterResponse } from '@/lib/notify';
import { formatPkr } from '@/lib/rider-wallet-config';
import type { ChangeRiderResult, QuoteResult } from '@/lib/monthly-rider';

// The notifications that an admin's and an area manager's monthly rider actions send, so both routes say the same thing.

const CUSTOMER_PAGE = '/account/monthly-rider';

/** The price and rider were set: the customer is told to pay. */
export function notifyMonthlyQuote(id: string, result: Extract<QuoteResult, { ok: true }>) {
  notifyAfterResponse(async () => ({
    userId: result.customerUserId,
    type: 'ACCOUNT' as const,
    title: 'Your monthly rider is ready to pay',
    message: `${result.riderName} can be your rider for a month (${result.ref}) for ${formatPkr(result.priceRs)}. Pay and enter the transaction ID to start.`,
    href: CUSTOMER_PAGE,
    refId: `monthly-rider:${id}`,
  }));
}

/** A running booking went to another rider: the customer, the new rider and the old rider are told. */
export function notifyMonthlyRiderChange(id: string, result: Extract<ChangeRiderResult, { ok: true }>) {
  notifyAfterResponse(async () => [
    {
      userId: result.customerUserId,
      type: 'ACCOUNT' as const,
      title: 'Your monthly rider was changed',
      message: `${result.riderName} is now your monthly rider (${result.ref}).`,
      href: CUSTOMER_PAGE,
      refId: `monthly-rider:${id}`,
    },
    {
      userId: result.riderUserId,
      type: 'ACCOUNT' as const,
      title: 'New monthly customer',
      message: `A monthly customer (${result.ref}) was given to you. Their orders come to you first once their month is active.`,
      href: '/rider',
      refId: `monthly-rider-rider:${id}`,
    },
    ...(result.previousRiderUserId
      ? [
          {
            userId: result.previousRiderUserId,
            type: 'ACCOUNT' as const,
            title: 'Monthly customer moved',
            message: `The monthly booking ${result.ref} was given to another rider.`,
            href: '/rider',
            refId: `monthly-rider-rider:${id}`,
          },
        ]
      : []),
  ]);
}
