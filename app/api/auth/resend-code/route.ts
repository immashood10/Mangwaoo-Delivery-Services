import { NextRequest, NextResponse } from 'next/server';
import { resendVerificationCode } from '@/lib/phone-verification';

/** The code screen's "Resend code": sends a new code for the same verification (limited to one a minute). */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const ticket = typeof body?.ticket === 'string' ? body.ticket : '';

  if (!ticket) {
    return NextResponse.json({ error: 'This verification has expired. Please start again.', restart: true }, { status: 400 });
  }

  return resendVerificationCode(request, ticket);
}
