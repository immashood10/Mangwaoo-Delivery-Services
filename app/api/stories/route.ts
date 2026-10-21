import { NextResponse } from 'next/server';
import { getStoriesForViewer } from '@/lib/stories';

/** The stories on the website logo right now, oldest first, each marked as seen or not by whoever is asking. */
export async function GET() {
  return NextResponse.json(
    { stories: await getStoriesForViewer() },
    // "Seen" is different for everyone, so this is not for shared caches.
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
