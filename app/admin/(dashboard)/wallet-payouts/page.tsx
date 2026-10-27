import { redirect } from 'next/navigation';
import { Banknote } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getLoyaltySettings } from '@/lib/points';
import AdminWalletPayouts from '@/components/AdminWalletPayouts';
import AutoRefresh from '@/components/AutoRefresh';

export const metadata = {
  title: 'Wallet Payouts - Mangwaoo Admin',
};

const RECENT_LIMIT = 30;

export default async function AdminWalletPayoutsPage() {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    redirect('/admin/login');
  }

  const customerSelect = { select: { user: { select: { name: true, phone: true, deletedAt: true } } } } as const;

  const [settings, pending, recent, held, paidOut, issued] = await Promise.all([
    getLoyaltySettings(),
    prisma.walletWithdrawal.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, include: { customer: customerSelect } }),
    prisma.walletWithdrawal.findMany({
      where: { status: { in: ['PAID', 'REJECTED'] } },
      orderBy: [{ reviewedAt: 'desc' }, { createdAt: 'desc' }],
      take: RECENT_LIMIT,
      include: { customer: customerSelect },
    }),
    prisma.customer.aggregate({ _sum: { points: true, walletBalance: true } }),
    prisma.walletWithdrawal.aggregate({ where: { status: 'PAID' }, _sum: { amount: true }, _count: true }),
    prisma.walletEntry.aggregate({ where: { type: 'CASHBACK' }, _sum: { amount: true } }),
  ]);

  // What a waiting request's owner has won so far, to help check it.
  const customerIds = [...new Set(pending.map((request) => request.customerId))];
  const [wins, cashbacks] =
    customerIds.length > 0
      ? await Promise.all([
          prisma.pointsEntry.groupBy({ by: ['customerId'], where: { customerId: { in: customerIds }, type: 'EARNED' }, _count: { _all: true } }),
          prisma.walletEntry.groupBy({ by: ['customerId'], where: { customerId: { in: customerIds }, type: 'CASHBACK' }, _sum: { amount: true } }),
        ])
      : [[], []];
  const ordersWon = new Map(wins.map((row) => [row.customerId, row._count._all]));
  const cashbackWon = new Map(cashbacks.map((row) => [row.customerId, row._sum.amount ?? 0]));

  const waitingAmount = pending.reduce((sum, request) => sum + request.amount, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <AutoRefresh />
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-red-primary/10 px-4 py-2 text-sm font-semibold text-accent">
        <Banknote className="h-4 w-4" />
        Admin
      </div>
      <h1 className="mb-2 text-3xl font-bold text-ink">Wallet Payouts</h1>
      <p className="mb-8 max-w-3xl text-brand-gray">
        Customers win Mangwaoo Points on delivered orders, cash them in for cashback and ask to send their wallet money to their own JazzCash or
        EasyPaisa. Send each request by hand from Mangwaoo&apos;s account, then mark it sent with the transaction ID. A request you turn down goes
        back to the customer&apos;s wallet.
      </p>

      <AdminWalletPayouts
        settings={settings}
        stats={{
          waitingCount: pending.length,
          waitingAmount,
          pointsHeld: held._sum.points ?? 0,
          walletHeld: held._sum.walletBalance ?? 0,
          paidCount: paidOut._count,
          paidAmount: paidOut._sum.amount ?? 0,
          cashbackIssued: issued._sum.amount ?? 0,
        }}
        pending={pending.map((request) => ({
          id: request.id,
          customerName: request.customer.user.name,
          customerPhone: request.customer.user.phone,
          accountRemoved: request.customer.user.deletedAt !== null,
          amount: request.amount,
          method: request.method,
          accountNumber: request.accountNumber,
          accountName: request.accountName,
          createdAt: request.createdAt.toISOString(),
          ordersWon: ordersWon.get(request.customerId) ?? 0,
          cashbackWon: cashbackWon.get(request.customerId) ?? 0,
        }))}
        recent={recent.map((request) => ({
          id: request.id,
          customerName: request.customer.user.name,
          amount: request.amount,
          method: request.method,
          accountNumber: request.accountNumber,
          status: request.status === 'PAID' ? ('PAID' as const) : ('REJECTED' as const),
          transactionId: request.transactionId,
          rejectionReason: request.rejectionReason,
          reviewedAt: (request.reviewedAt ?? request.createdAt).toISOString(),
        }))}
      />
    </div>
  );
}
