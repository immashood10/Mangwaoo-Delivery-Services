import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CircleDashed } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { getAdminStories } from '@/lib/stories';
import { AD_PLACEMENTS } from '@/lib/ad-config';
import { STORY_LIFETIME_HOURS } from '@/lib/story-types';
import AdminStories from '@/components/AdminStories';
import AutoRefresh from '@/components/AutoRefresh';

export const metadata = {
  title: 'Stories - Mangwaoo Admin',
};

export default async function AdminStoriesPage() {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    redirect('/admin/login');
  }

  const stories = await getAdminStories();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <AutoRefresh intervalMs={60000} />
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-red-primary/10 px-4 py-2 text-sm font-semibold text-accent">
        <CircleDashed className="h-4 w-4" />
        Admin
      </div>
      <h1 className="mb-2 text-3xl font-bold text-ink">Stories</h1>
      <p className="mb-3 text-brand-gray">
        Post a photo or a message and it appears on the Mangwaoo logo for everyone, like a WhatsApp status. It disappears by
        itself after {STORY_LIFETIME_HOURS} hours, or you can delete it sooner.
      </p>
      <p className="mb-8 rounded-xl bg-brand-light px-4 py-3 text-sm text-brand-gray">
        Sellers can also buy a <span className="font-semibold text-ink">story ad</span> for their product: Rs{' '}
        {AD_PLACEMENTS.STORY.priceRs} for one day. Approve those in{' '}
        <Link href="/admin/ads" className="font-semibold text-accent hover:underline">
          Ad Requests
        </Link>{' '}
        and they show up here too.
      </p>

      <AdminStories stories={stories} />
    </div>
  );
}
