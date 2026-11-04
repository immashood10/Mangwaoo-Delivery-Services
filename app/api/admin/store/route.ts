import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createOfficialSeller } from '@/lib/official-store';

/** An admin sets up Mangwaoo's own MangwaooMart store (a hidden seller named "Mangwaoo"); pressing it again changes nothing. */
export async function POST() {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 });
  }

  const { created } = await createOfficialSeller();

  return NextResponse.json({ ok: true, created }, { status: created ? 201 : 200 });
}
