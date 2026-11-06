import FoodReels from '@/components/reels/FoodReels';
export default async function ReelsPage({ searchParams }: { searchParams: Promise<{ mine?: string; reel?: string }> }) {
  const query = await searchParams;
  return <FoodReels mode={query.mine === '1' ? 'mine' : 'feed'} initialId={query.reel}/>;
}
