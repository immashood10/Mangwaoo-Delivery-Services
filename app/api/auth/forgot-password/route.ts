import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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

  if (!email) {
    return NextResponse.json({ error: 'Please enter your email address.' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Always return the same generic response whether or not the account
  // exists, so this endpoint can't be used to enumerate registered emails.
  if (!user || !user.phone) {
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

  const resetUrl = `${request.nextUrl.origin}/reset-password?token=${rawToken}`;

  await sendWhatsAppTemplate(whatsappNumber, RESET_TEMPLATE_NAME, [resetUrl]);

  return genericResponse();
}
