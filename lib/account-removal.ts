import type { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { releaseUncoveredAreaChats } from '@/lib/area-managers';
import { releaseCouponIfUnused } from '@/lib/coupons';
import { closeCustomerLoyaltyCard, releaseLoyaltyIfUnused } from '@/lib/loyalty-card';
import { invalidateBanSnapshot } from '@/lib/bans';
import { refreshFoodCatalog, refreshMartCatalog, refreshStories } from '@/lib/catalog-cache';
import { orderRef } from '@/lib/order-number';
import { statusStamp } from '@/lib/order-tracking';
import { closeCustomerPoints } from '@/lib/points';
import { SELLER_PAGES } from '@/lib/notification-types';
import { ORDER_RECORD_CHAT_SELECT, orderSnapshot, recordRiderOrder } from '@/lib/rider-orders';

// Deleting an account (Admin > Users). Other people's records depend on an account's rows — a seller's order history
// lists the customers, a customer's orders list the sellers — so the account is not erased from the database.
// It is emptied instead: personal details and personal data are removed, it can never log in again, its email and
// number are free for a new signup, and what must stay for others (orders, chats) keeps pointing at "Deleted account".

const OPEN_ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING'] as const;
const REMOVAL_TRANSACTION = { timeout: 60000, maxWait: 10000 };

export const DELETED_ACCOUNT_NAME = 'Deleted account';

export type RemovalResult = { ok: true; cancelledOrders: number } | { ok: false; status: number; error: string };

type OrderOwner = { customerId: string } | { sellerId: string };

/**
 * Cancels the orders of one account that have not left the kitchen yet, the way the cancel buttons do (stock goes back,
 * a coupon use is given back). Returns how many it cancelled, and tells the seller of each one that has a bell.
 */
async function cancelOpenOrders(tx: Prisma.TransactionClient, owner: OrderOwner, notifySellers: boolean) {
  let cancelled = 0;
  const where = { ...owner, status: { in: [...OPEN_ORDER_STATUSES] } };
  const [martOrders, foodOrders] = await Promise.all([
    tx.order.findMany({ where, include: { items: true, seller: { select: { userId: true } } } }),
    tx.gulplazaOrder.findMany({ where, include: { items: true, seller: { select: { userId: true } } } }),
  ]);

  const notes: Prisma.NotificationCreateManyInput[] = [];
  const note = (orderId: string, ref: string, sellerUserId: string) => {
    if (!notifySellers) return;

    notes.push({
      userId: sellerUserId,
      type: 'ORDER',
      title: 'Order cancelled',
      message: `Order ${ref} was cancelled: the customer's account was removed.`,
      href: SELLER_PAGES.completed,
      refId: `cancel:${orderId}`,
    });
  };

  for (const order of martOrders) {
    // The status guard keeps this from running twice if the order moves on at the same moment.
    const changed = await tx.order.updateMany({ where: { id: order.id, status: { in: [...OPEN_ORDER_STATUSES] } }, data: { status: 'CANCELLED', ...statusStamp('CANCELLED') } });
    if (changed.count === 0) continue;

    for (const item of order.items) {
      await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
    }

    await releaseCouponIfUnused(tx, order.redemptionId);
    await releaseLoyaltyIfUnused(tx, order.loyaltyRedemptionId);
    note(order.id, orderRef('mart', order.orderNumber), order.seller.userId);
    cancelled += 1;
  }

  for (const order of foodOrders) {
    const changed = await tx.gulplazaOrder.updateMany({ where: { id: order.id, status: { in: [...OPEN_ORDER_STATUSES] } }, data: { status: 'CANCELLED', ...statusStamp('CANCELLED') } });
    if (changed.count === 0) continue;

    for (const item of order.items) {
      await tx.gulplazaProduct.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
    }

    await releaseCouponIfUnused(tx, order.redemptionId);
    await releaseLoyaltyIfUnused(tx, order.loyaltyRedemptionId);
    note(order.id, orderRef('gulplaza', order.orderNumber), order.seller.userId);
    cancelled += 1;
  }

  if (notes.length > 0) await tx.notification.createMany({ data: notes });

  return cancelled;
}

/** Deletes an account as described at the top of this file. */
export async function removeAccount(userId: string, adminId: string): Promise<RemovalResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      deletedAt: true,
      customer: { select: { id: true } },
      seller: { select: { id: true } },
      rider: { select: { id: true } },
      areaManager: { select: { areaId: true } },
    },
  });

  if (!user || user.deletedAt) return { ok: false, status: 404, error: 'Account not found.' };
  if (user.role === 'ADMIN') return { ok: false, status: 403, error: "Admin accounts can't be deleted here." };
  if (user.id === adminId) return { ok: false, status: 403, error: "You can't delete your own account." };

  const now = new Date();

  const cancelledOrders = await prisma.$transaction(async (tx) => {
    let cancelled = 0;

    if (user.customer) {
      const customerId = user.customer.id;

      cancelled += await cancelOpenOrders(tx, { customerId }, true);
      // The Loyalty Card can never be used or applied for again.
      await closeCustomerLoyaltyCard(tx, customerId);
      // An order a rider had taken ends here: the rider's history says Mangwaoo closed it.
      const takenChats = await tx.riderChat.findMany({
        where: { customerId, status: 'ACTIVE', riderId: { not: null } },
        select: ORDER_RECORD_CHAT_SELECT,
      });
      for (const chat of takenChats) {
        const snapshot = orderSnapshot(chat);
        if (snapshot) await recordRiderOrder(tx, snapshot, { status: 'CLOSED' });
      }
      await tx.riderChat.updateMany({ where: { customerId, status: { in: ['OPEN', 'ACTIVE'] } }, data: { status: 'CLOSED' } });
      // The riders' order history keeps its lines, but they point at "Deleted account" like the orders and chats do.
      await tx.riderOrderRecord.updateMany({ where: { customerId }, data: { customerName: DELETED_ACCOUNT_NAME } });
      await tx.cartItem.deleteMany({ where: { customerId } });
      // Nothing is sent to a removed account: waiting withdrawals are turned down and the points and wallet are written off.
      await closeCustomerPoints(tx, customerId);
    }

    if (user.seller) {
      const sellerId = user.seller.id;

      cancelled += await cancelOpenOrders(tx, { sellerId }, false);
      await tx.seller.update({ where: { id: sellerId }, data: { isApproved: false, coverUpdatedAt: null } });
      await tx.sellerCover.deleteMany({ where: { sellerId } });
      // The store disappears: listings are hidden, requests for ads are declined and running ads (and their stories) end.
      await tx.product.updateMany({ where: { sellerId }, data: { isActive: false } });
      await tx.gulplazaProduct.updateMany({ where: { sellerId }, data: { isActive: false } });
      await tx.productAd.updateMany({
        where: { sellerId, status: 'PENDING' },
        data: { status: 'REJECTED', rejectionReason: 'The seller account was removed.', reviewedAt: now },
      });
      await tx.productAd.updateMany({ where: { sellerId, status: 'ACTIVE', endsAt: { gt: now } }, data: { endsAt: now } });
      await tx.story.updateMany({ where: { ad: { sellerId }, expiresAt: { gt: now } }, data: { expiresAt: now } });
      await tx.cartItem.deleteMany({ where: { sellerId } });
    }

    if (user.rider) {
      const riderId = user.rider.id;

      await tx.rider.update({ where: { id: riderId }, data: { isApproved: false, isAvailable: false, lastSeenAt: null } });
      // Chats this rider was handling go back to waiting for another rider.
      await tx.riderChat.updateMany({ where: { riderId, status: 'ACTIVE' }, data: { status: 'OPEN', riderId: null, claimedAt: null } });
    }

    if (user.areaManager) {
      // The manager's post ends. An area left without a manager sends its running order chats back to "first rider to reply",
      // so no customer waits for a manager who is not there.
      await tx.areaManager.delete({ where: { userId } });
      await releaseUncoveredAreaChats(tx, user.areaManager.areaId);
    }

    // Personal data goes. (One-off delivery addresses stay: the orders they belong to are other people's records.)
    await tx.passwordResetToken.deleteMany({ where: { userId } });
    await tx.phoneVerification.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.supportThread.deleteMany({ where: { userId } });
    await tx.pushSubscription.deleteMany({ where: { userId } });
    await tx.favourite.deleteMany({ where: { userId } });
    await tx.productLike.deleteMany({ where: { userId } });
    await tx.address.deleteMany({ where: { userId, isSaved: true } });
    await tx.storyView.deleteMany({ where: { viewerKey: `u:${userId}` } });
    await tx.userBan.updateMany({ where: { userId, liftedAt: null }, data: { liftedAt: now } });

    await tx.user.update({
      where: { id: userId },
      data: {
        name: DELETED_ACCOUNT_NAME,
        email: `deleted-${userId}@deleted.invalid`,
        phone: null,
        // Not a valid password hash, so no password ever matches it.
        password: '!',
        isActive: false,
        phoneVerifiedAt: null,
        deletedAt: now,
      },
    });

    return cancelled;
  }, REMOVAL_TRANSACTION);

  // This server notices at once (others within seconds), and what the store sold disappears from the catalogs.
  invalidateBanSnapshot();
  if (user.seller) {
    refreshMartCatalog();
    refreshFoodCatalog();
    refreshStories();
  }

  return { ok: true, cancelledOrders };
}
