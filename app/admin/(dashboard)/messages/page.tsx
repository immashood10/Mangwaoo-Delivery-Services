import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { getSession } from '@/lib/auth';
import AdminMessages from '@/components/AdminMessages';

export const metadata = {
  title: 'Messages - Mangwaoo Admin',
};

export default async function AdminMessagesPage({ searchParams }: { searchParams: Promise<{ user?: string; tab?: string }> }) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    redirect('/admin/login');
  }

  const { user, tab } = await searchParams;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-red-primary/10 px-4 py-2 text-sm font-semibold text-accent">
        <MessageCircle className="h-4 w-4" />
        Admin
      </div>
      <h1 className="mb-2 text-3xl font-bold text-ink">Messages</h1>
      <p className="mb-8 text-brand-gray">
        Write to a seller or rider, or open any customer–seller chat and reply in it as Mangwaoo Support. Chats between
        customers and riders are in{' '}
        <Link href="/admin/rider-chats" className="font-semibold text-accent hover:underline">
          Order Chats
        </Link>
        , where you can reply the same way.
      </p>

      <AdminMessages initialTab={tab === 'chats' && !user ? 'chats' : 'support'} initialUserId={user} />
    </div>
  );
}
