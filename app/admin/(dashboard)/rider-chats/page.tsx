import { redirect } from 'next/navigation';
import { MessagesSquare } from 'lucide-react';
import { getSession } from '@/lib/auth';
import AdminRiderChats from '@/components/AdminRiderChats';
import { parseChatFilter } from '@/lib/admin-chat-filter';
import { startOfKarachiDay } from '@/lib/admin-stats';

export default async function AdminRiderChatsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    redirect('/admin/login');
  }

  const initialFilter = parseChatFilter((await searchParams).filter);
  // eslint-disable-next-line react-hooks/purity -- server component, rendered per request
  const todayStartIso = new Date(startOfKarachiDay(Date.now())).toISOString();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="inline-flex items-center gap-2 rounded-full bg-brand-red-primary/10 px-4 py-2 text-sm font-semibold text-accent mb-3">
        <MessagesSquare className="w-4 h-4" />
        Admin
      </div>
      <h1 className="text-3xl font-bold text-ink mb-2">Order Chats</h1>
      <p className="text-brand-gray mb-8">
        Every customer order chat. Unclaimed chats wait for the nearest rider — you can reply to any of them as
        Mangwaoo Support.
      </p>

      <AdminRiderChats initialFilter={initialFilter} todayStartIso={todayStartIso} />
    </div>
  );
}
