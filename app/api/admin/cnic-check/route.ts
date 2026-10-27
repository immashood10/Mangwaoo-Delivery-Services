import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { testCnicCheck } from '@/lib/cnic-check';
import { enforceRateLimits } from '@/lib/rate-limit';

// A test call to the AI takes a few seconds, longer when Anthropic is slow.
export const maxDuration = 60;

// The admin's "Test it" button on Rider Approvals: one tiny picture is shown to the AI, to see that the key, the model
// and the answer format all work. It costs a fraction of a cent, so it is limited per admin.
export async function POST() {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 });
  }

  const limited = await enforceRateLimits([{ scope: 'cnic-check-test', subject: session.userId, limit: 20, windowSeconds: 3600 }]);

  if (limited) return limited;

  return NextResponse.json(await testCnicCheck());
}
