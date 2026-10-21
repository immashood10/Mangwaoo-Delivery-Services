import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getOrCreateVisitor } from '@/lib/visitor';

/**
 * Records that the person asking watched a story. A logged-in account is remembered by its user id (so it
 * follows them to any device); an anonymous browser by its visitor cookie, which is set here the first time.
 * Repeating it changes nothing.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const story = await prisma.story.findFirst({ where: { id, expiresAt: { gt: new Date() } }, select: { id: true } });

  if (!story) {
    return NextResponse.json({ error: 'This story is no longer available.' }, { status: 404 });
  }

  const session = await getSession();
  const viewerKey = session ? `u:${session.userId}` : `v:${(await getOrCreateVisitor()).id}`;

  await prisma.storyView.createMany({ data: [{ storyId: story.id, viewerKey }], skipDuplicates: true });

  return NextResponse.json({ ok: true });
}
