import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientIp } from '@/lib/client-ip';
import { enforceRateLimits } from '@/lib/rate-limit';
import { siteOrigin } from '@/lib/site-url';
import { normalizeWhatsAppNumber, sendWhatsAppTemplate } from '@/lib/whatsapp';

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const RESET_TEMPLATE_NAME = process.env.WHATSAPP_RESET_TEMPLATE_NAME || 'password_reset';

function genericResponse() {
  return NextResponse.json({
    message:
      'If an account with that email exists and has a phone number on file, we’ve sent a password reset link over WhatsApp.',
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!email || email.length > 254) {
    return NextResponse.json({ error: 'Please enter your email address.' }, { status: 400 });
  }

  // Every WhatsApp message costs money and lands on someone's phone: few per network address, fewer per account.
  const limited = await enforceRateLimits([
    { scope: 'forgot-ip', subject: clientIp(request), limit: 10, windowSeconds: 3600 },
    { scope: 'forgot-email', subject: email, limit: 3, windowSeconds: 3600 },
  ]);

  if (limited) return limited;

  const user = await prisma.user.findUnique({ where: { email } });

  // Always return the same generic response whether or not the account
  // exists, so this endpoint can't be used to enumerate registered emails.
  // An account that never confirmed its WhatsApp number is just an unfinished
  // signup, so it gets no reset link either.
  if (!user || !user.phone || !user.phoneVerifiedAt) {
    return genericResponse();
  }

  const whatsappNumber = normalizeWhatsAppNumber(user.phone);
  if (!whatsappNumber) {
    return genericResponse();
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const resetUrl = `${siteOrigin(request)}/reset-password?token=${rawToken}`;

  await sendWhatsAppTemplate(whatsappNumber, RESET_TEMPLATE_NAME, [resetUrl]);

  return genericResponse();
}
