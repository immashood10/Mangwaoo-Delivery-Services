import { NextRequest, NextResponse } from 'next/server';
import { clientIp } from '@/lib/client-ip';
import { enforceRateLimits } from '@/lib/rate-limit';
import { sendWhatsAppNotification } from '@/lib/whatsapp';

const MAX_NAME = 100;
const MAX_EMAIL = 254;
const MAX_PHONE = 30;
const MAX_SUBJECT = 150;
const MAX_MESSAGE = 3000;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** One line of plain text: no line breaks or control characters that could fake extra lines in the owner's WhatsApp. */
function oneLine(value: unknown, max: number) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max + 1) : '';
}

// The public contact form: every message goes to the owner's WhatsApp, so it is limited per visitor.
export async function POST(request: NextRequest) {
  const limited = await enforceRateLimits(
    [{ scope: 'contact-ip', subject: clientIp(request), limit: 5, windowSeconds: 3600 }],
    'You have sent several messages already. Please try again later.'
  );

  if (limited) return limited;

  const body = await request.json().catch(() => null);

  const name = oneLine(body?.name, MAX_NAME);
  const email = oneLine(body?.email, MAX_EMAIL);
  const phone = oneLine(body?.phone, MAX_PHONE);
  const subject = oneLine(body?.subject, MAX_SUBJECT);
  const message = typeof body?.message === 'string' ? body.message.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim() : '';

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: 'Please fill in all required fields.' }, { status: 400 });
  }

  if (name.length > MAX_NAME || email.length > MAX_EMAIL || phone.length > MAX_PHONE || subject.length > MAX_SUBJECT || message.length > MAX_MESSAGE) {
    return NextResponse.json({ error: 'One of the fields is too long.' }, { status: 400 });
  }

  if (!EMAIL_SHAPE.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  await sendWhatsAppNotification(
    [
      '📩 New contact message',
      `Subject: ${subject}`,
      `Name: ${name}`,
      `Email: ${email}`,
      phone ? `Phone: ${phone}` : null,
      '',
      message,
    ]
      .filter(Boolean)
      .join('\n')
  );

  return NextResponse.json({ success: true }, { status: 201 });
}
