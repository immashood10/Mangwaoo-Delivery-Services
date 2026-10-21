import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Settings } from 'lucide-react';
import AccountSettings from '@/components/AccountSettings';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function AccountSettingsPage() {
  const session = await getSession();

  if (!session || session.role !== 'CUSTOMER') {
    redirect('/login?next=/account/settings');
  }

  const [user, addresses] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true, phone: true },
    }),
    prisma.address.findMany({
      where: { userId: session.userId, isSaved: true },
      orderBy: { createdAt: 'desc' },
      select: { id: true, label: true, street: true },
    }),
  ]);

  if (!user) {
    redirect('/login?next=/account/settings');
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/account" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-gray hover:text-accent">
        <ArrowLeft className="h-4 w-4" />
        My Orders
      </Link>

      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-red-primary/10 text-accent">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-ink">Settings</h1>
          <p className="text-brand-gray">Manage your details, saved addresses and password.</p>
        </div>
      </div>

      <AccountSettings
        name={user.name}
        phone={user.phone ?? ''}
        email={user.email}
        addresses={addresses.map((address) => ({
          id: address.id,
          label: address.label ?? 'Other',
          street: address.street,
        }))}
      />
    </div>
  );
}
