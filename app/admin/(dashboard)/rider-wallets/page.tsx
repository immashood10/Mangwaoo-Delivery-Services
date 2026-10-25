import { redirect } from 'next/navigation';
import { Wallet } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RIDER_ONLINE_WINDOW_MS } from '@/lib/rider-dispatch';
import { getWalletSettings } from '@/lib/rider-wallet';
import { riderHold } from '@/lib/rider-wallet-config';
import AdminRiderWallets from '@/components/AdminRiderWallets';
import AutoRefresh from '@/components/AutoRefresh';

export const metadata = {
  title: 'Rider Wallets - Mangwaoo Admin',
};

export default async function AdminRiderWalletsPage() {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    redirect('/admin/login');
  }

  const [riders, pending, settings] = await Promise.all([
    prisma.rider.findMany({
      // Approved riders, plus anyone who already has money on their account; unfinished signups and deleted accounts are skipped.
      where: { user: { phoneVerifiedAt: { not: null }, deletedAt: null }, OR: [{ isApproved: true }, { ledger: { some: {} } }] },
      select: {
        id: true,
        vehicleType: true,
        isApproved: true,
        isAvailable: true,
        lastSeenAt: true,
        walletBalance: true,
        unpaidOrders: true,
        paymentHold: true,
        orderAccess: true,
        user: { select: { id: true, name: true, phone: true } },
        _count: { select: { ledger: { where: { type: 'COMMISSION' } } } },
      },
    }),
    prisma.riderTopUp.findMany({
      where: { status: 'PENDING', rider: { user: { deletedAt: null } } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        riderId: true,
        amount: true,
        method: true,
        transactionId: true,
        createdAt: true,
        // Only whether a screenshot exists: the picture itself is loaded by the admin-only screenshot route.
        screenshot: { select: { id: true } },
        rider: { select: { user: { select: { name: true, phone: true } } } },
      },
    }),
    getWalletSettings(),
  ]);

  // eslint-disable-next-line react-hooks/purity -- server component, rendered per request
  const onlineSince = Date.now() - RIDER_ONLINE_WINDOW_MS;

  const rows = riders
    .map((rider) => ({
      id: rider.id,
      userId: rider.user.id,
      name: rider.user.name,
      phone: rider.user.phone,
      vehicleType: rider.vehicleType,
      isApproved: rider.isApproved,
      isOnline: rider.isApproved && rider.isAvailable && rider.lastSeenAt !== null && rider.lastSeenAt.getTime() >= onlineSince,
      completedOrders: rider._count.ledger,
      balance: rider.walletBalance,
      unpaidOrders: rider.unpaidOrders,
      paymentHold: rider.paymentHold,
      orderAccess: rider.orderAccess,
      hold: riderHold(rider),
    }))
    // Riders who can't take orders first, then whoever owes the most.
    .sort((a, b) => Number(b.hold !== null) - Number(a.hold !== null) || a.balance - b.balance || a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <AutoRefresh />
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-red-primary/10 px-4 py-2 text-sm font-semibold text-accent">
        <Wallet className="h-4 w-4" />
        Admin
      </div>
      <h1 className="mb-2 text-3xl font-bold text-ink">Rider Wallets</h1>
      <p className="mb-8 text-brand-gray">
        Mangwaoo keeps {settings.commissionPercent}% of the delivery charge of every order a rider completes. A rider can have {settings.ordersOnCredit}{' '}
        finished orders unpaid; after that they can&apos;t receive the next order until they pay. You decide who is eligible: add the payments you
        receive, remind riders to recharge, or allow / block a rider yourself.
      </p>

      <AdminRiderWallets
        riders={rows}
        pending={pending.map((topUp) => ({
          id: topUp.id,
          riderId: topUp.riderId,
          riderName: topUp.rider.user.name,
          riderPhone: topUp.rider.user.phone,
          amount: topUp.amount,
          method: topUp.method,
          transactionId: topUp.transactionId,
          hasScreenshot: topUp.screenshot !== null,
          createdAt: topUp.createdAt.toISOString(),
        }))}
        settings={settings}
      />
    </div>
  );
}
