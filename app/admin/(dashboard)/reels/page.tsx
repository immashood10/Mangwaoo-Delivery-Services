import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import FoodReels from '@/components/reels/FoodReels';
export default async function AdminReelsPage() {
  if ((await getSession())?.role !== 'ADMIN') redirect('/admin/login');
  return <FoodReels mode="admin"/>;
}
