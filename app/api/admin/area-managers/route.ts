import { NextRequest, NextResponse } from 'next/server';
import { createManager, listManagers, parseNewManager, requireSuperAdmin } from '@/lib/area-managers';
import { enforceRateLimits } from '@/lib/rate-limit';

/** The Area Sales Managers, for the super admin's page. */
export async function GET() {
  const auth = await requireSuperAdmin();
  if ('error' in auth) return auth.error;

  return NextResponse.json({ managers: await listManagers() }, { headers: { 'Cache-Control': 'no-store' } });
}

/**
 * The super admin makes a manager account for one service area. The account is ready at once: there is no WhatsApp code to
 * confirm, the super admin gives the person the login name and the password.
 */
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if ('error' in auth) return auth.error;

  const limited = await enforceRateLimits([{ scope: 'asm-create', subject: auth.adminId, limit: 30, windowSeconds: 3600 }]);
  if (limited) return limited;

  const parsed = parseNewManager(await request.json().catch(() => null));

  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await createManager(parsed.input);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ manager: result.manager }, { status: 201 });
}
