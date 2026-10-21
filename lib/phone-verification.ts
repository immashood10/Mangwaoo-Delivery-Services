import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { isWhatsAppConfigured, sendWhatsAppCode } from '@/lib/whatsapp';
import { maskPhone, normalizePakistaniMobile, toLocalPhone } from '@/lib/phone';
import { usesFirebasePhone, verifyFirebasePhoneToken } from '@/lib/firebase-phone';
import { CODE_LENGTH, type PhoneVerificationInfo, type VerifiedUser } from '@/lib/phone-verification-types';

// WhatsApp verification. A new account only exists as "unverified" until its owner types the code sent to the
// number on WhatsApp; only then can it log in (the admin account is exempt). Everything lives in the database:
// the browser keeps nothing but an opaque `ticket` in React state while the code screen is open.

type Purpose = 'ACCOUNT' | 'CHANGE';

const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;
export const RESEND_COOLDOWN_SECONDS = 60;
const MAX_SENDS_PER_PHONE_PER_HOUR = 5;
const MAX_SENDS_PER_IP_PER_HOUR = 20;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const PURGE_ONE_IN = 20;

export const INVALID_PHONE_MESSAGE = 'Please enter a valid Pakistani mobile number, e.g. 0300-1234567.';
const ACCOUNT_EXISTS_MESSAGE = 'An account with this email or phone already exists.';
const EXPIRED_VERIFICATION_MESSAGE = 'This verification has expired. Please start again.';

/** Whether this account may log in: its number was confirmed, or it is the admin (who has no phone). */
export function canLogIn(user: { role: string; phoneVerifiedAt: Date | null }) {
  return user.role === 'ADMIN' || user.phoneVerifiedAt !== null;
}

// ── Secrets and hashes ──────────────────────────────────────

function keyed(label: string, value: string) {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error('AUTH_SECRET environment variable is not set');
  }

  return crypto.createHmac('sha256', secret).update(`${label}:${value}`).digest('hex');
}

// The ticket is 24 random bytes, so a plain hash is enough; a code has only a million values, so it is keyed.
const hashTicket = (ticket: string) => crypto.createHash('sha256').update(ticket).digest('hex');
const hashCode = (phone: string, code: string) => keyed('wa-code', `${phone}:${code}`);
const hashIp = (ip: string) => keyed('ip', ip);
const newTicket = () => crypto.randomBytes(24).toString('base64url');
const newCode = () => crypto.randomInt(0, 10 ** CODE_LENGTH).toString().padStart(CODE_LENGTH, '0');

function sameHash(a: string, b: string) {
  return a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** The caller's address as the hosting platform reports it; null when it isn't (e.g. local development). */
function clientIp(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();

  return forwarded || request.headers.get('x-real-ip') || null;
}

function errorCode(error: unknown) {
  return (error as { code?: string } | null)?.code;
}

function fail(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

function tooMany(error: string, retryAfter: number) {
  return NextResponse.json({ error, retryAfter }, { status: 429, headers: { 'Retry-After': String(retryAfter) } });
}

const minutes = (seconds: number) => Math.max(1, Math.ceil(seconds / 60));

// ── Sending a code ──────────────────────────────────────────

type VerificationRecord = {
  purpose: Purpose;
  phone: string;
  ticketHash: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
};

export type CodeSent =
  | {
      ok: true;
      info: PhoneVerificationInfo;
      /** The row to store for this code (`attempts` starts again at 0). */
      record: VerificationRecord;
      /** Records the send for the rate limits; run it in the same transaction as the row above. */
      logSend: Prisma.PrismaPromise<unknown>;
    }
  | { ok: false; response: NextResponse };

/**
 * Each number gets at most one code a minute and a few an hour, and a network can only ask for so many.
 * Without a known network (`ipHash` null) only the per-number limits apply: everyone would share one bucket.
 */
async function checkSendLimits(phone: string, ipHash: string | null, now: Date) {
  const since = new Date(now.getTime() - HOUR_MS);

  const [phoneSends, ipSends] = await Promise.all([
    prisma.phoneVerificationSend.findMany({
      where: { phone, createdAt: { gt: since } },
      orderBy: { createdAt: 'desc' },
      take: MAX_SENDS_PER_PHONE_PER_HOUR,
      select: { createdAt: true },
    }),
    ipHash
      ? prisma.phoneVerificationSend.findMany({
          where: { ipHash, createdAt: { gt: since } },
          orderBy: { createdAt: 'desc' },
          take: MAX_SENDS_PER_IP_PER_HOUR,
          select: { createdAt: true },
        })
      : [],
  ]);

  const secondsUntil = (from: Date, waitMs: number) => Math.max(1, Math.ceil((from.getTime() + waitMs - now.getTime()) / 1000));

  const latest = phoneSends[0]?.createdAt;

  if (latest && now.getTime() - latest.getTime() < RESEND_COOLDOWN_SECONDS * 1000) {
    const retryAfter = secondsUntil(latest, RESEND_COOLDOWN_SECONDS * 1000);

    return tooMany(`A code was just sent to this number. Please wait ${retryAfter} seconds before asking for another.`, retryAfter);
  }

  if (phoneSends.length >= MAX_SENDS_PER_PHONE_PER_HOUR) {
    const retryAfter = secondsUntil(phoneSends[phoneSends.length - 1].createdAt, HOUR_MS);

    return tooMany(`Too many codes were sent to this number. Please try again in ${minutes(retryAfter)} minutes.`, retryAfter);
  }

  if (ipSends.length >= MAX_SENDS_PER_IP_PER_HOUR) {
    const retryAfter = secondsUntil(ipSends[ipSends.length - 1].createdAt, HOUR_MS);

    return tooMany(`Too many codes were requested from your network. Please try again in ${minutes(retryAfter)} minutes.`, retryAfter);
  }

  return null;
}

/** Puts the code on WhatsApp. Without WhatsApp credentials it only works in local development (test mode). */
async function deliverCode(phone: string, code: string): Promise<{ ok: true; devCode?: string } | { ok: false; response: NextResponse }> {
  if (isWhatsAppConfigured()) {
    const sent = await sendWhatsAppCode(phone, code);

    return sent
      ? { ok: true }
      : { ok: false, response: fail(502, "We couldn't send the code to that WhatsApp number. Please check the number and try again.") };
  }

  if (process.env.NODE_ENV === 'production') {
    console.error(
      'WhatsApp verification is not set up: set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN (see .env.example). Sign-ups and logins of new accounts are blocked until then.'
    );

    return { ok: false, response: fail(503, 'WhatsApp verification is not available right now. Please try again later.') };
  }

  // Local test mode: nothing is sent, so the code is handed back to be shown on the screen (never in production).
  console.info(`[WhatsApp test mode] verification code for +${phone}: ${code}`);

  return { ok: true, devCode: code };
}

/**
 * Sends a fresh code to `phone` and returns the row to store for it. Nothing is written here: the caller saves
 * `record` and runs `logSend` in its own transaction, so a failed send never leaves a code behind.
 */
export async function sendVerificationCode(
  request: NextRequest,
  phone: string,
  purpose: Purpose,
  existingTicket?: string
): Promise<CodeSent> {
  const now = new Date();
  const ip = clientIp(request);
  const ipHash = ip ? hashIp(ip) : null;

  const blocked = await checkSendLimits(phone, ipHash, now);

  if (blocked) {
    return { ok: false, response: blocked };
  }

  const code = newCode();
  const ticket = existingTicket ?? newTicket();
  const firebase = usesFirebasePhone();
  // With Firebase the browser asks Firebase to send the SMS itself, so nothing is delivered from here.
  const delivery = firebase ? ({ ok: true } as const) : await deliverCode(phone, code);

  if (!delivery.ok) {
    return delivery;
  }

  // Keep the send log small: now and then drop what is older than a day.
  if (Math.floor(Math.random() * PURGE_ONE_IN) === 0) {
    void prisma.phoneVerificationSend.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - DAY_MS) } } }).catch(() => undefined);
  }

  return {
    ok: true,
    info: {
      ticket,
      phone: maskPhone(phone),
      retryAfter: RESEND_COOLDOWN_SECONDS,
      ...('devCode' in delivery && delivery.devCode ? { devCode: delivery.devCode } : {}),
      ...(firebase ? { firebase: { phoneNumber: `+${phone}` } } : {}),
    },
    record: {
      purpose,
      phone,
      ticketHash: hashTicket(ticket),
      codeHash: hashCode(phone, code),
      expiresAt: new Date(now.getTime() + CODE_TTL_MS),
      attempts: 0,
      createdAt: now,
    },
    logSend: prisma.phoneVerificationSend.create({ data: { phone, ipHash: ipHash ?? 'unknown', createdAt: now } }),
  };
}

// ── Signing up ──────────────────────────────────────────────

type AccountRef = { id: string; role: string; phoneVerifiedAt: Date | null };

/**
 * Whether the email / number / CNIC are already used by an account that is really in use. Accounts that never
 * confirmed their number are just unfinished signups: they are listed in `staleUserIds` and replaced, so a typo
 * in a number never locks an email address out.
 */
async function findSignupConflicts(email: string, phone: string) {
  const [byEmail, byPhone] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true, role: true, phoneVerifiedAt: true } }),
    // Numbers are stored however they were typed, so compare the last ten digits (3001234567).
    prisma.$queryRaw<AccountRef[]>`
      SELECT id, role, "phoneVerifiedAt" FROM "User"
      WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = ${phone.slice(-10)}`,
  ]);

  const accounts = [byEmail, ...byPhone].filter((account): account is AccountRef => account !== null);

  if (accounts.some((account) => canLogIn(account))) {
    return { taken: true as const, reason: 'account' as const };
  }

  const staleUserIds = [...new Set(accounts.map((account) => account.id))];

  return { taken: false as const, staleUserIds };
}

/**
 * Deletes unfinished signups together with what they own (guarded so an account that was confirmed in the
 * meantime is left alone). These accounts never logged in, so they own nothing else.
 */
function deleteUnverifiedUsers(userIds: string[]): Prisma.PrismaPromise<unknown>[] {
  if (userIds.length === 0) return [];

  const owner = { user: { id: { in: userIds }, phoneVerifiedAt: null } };

  return [
    prisma.passwordResetToken.deleteMany({ where: owner }),
    prisma.customer.deleteMany({ where: owner }),
    prisma.seller.deleteMany({ where: owner }),
    prisma.rider.deleteMany({ where: owner }),
    prisma.user.deleteMany({ where: { id: { in: userIds }, phoneVerifiedAt: null } }),
  ];
}

export type PreparedSignup =
  | {
      ok: true;
      /** The number as stored on the account, e.g. 03001234567. */
      phone: string;
      /** Put this on the new user as `phoneVerification: { create: record }`. */
      record: VerificationRecord;
      /** Everything to run, in order, in one transaction, with the user's create in the middle. */
      writes: (createUser: Prisma.PrismaPromise<unknown>) => Prisma.PrismaPromise<unknown>[];
      info: PhoneVerificationInfo;
    }
  | { ok: false; response: NextResponse };

/**
 * First half of every signup: checks the number, makes sure nothing live uses these details, and sends the
 * code. The route then creates the (unverified) account with `writes` and answers with `info`.
 */
export async function prepareSignup(
  request: NextRequest,
  details: { email: string; phone: string }
): Promise<PreparedSignup> {
  const whatsappNumber = normalizePakistaniMobile(details.phone);

  if (!whatsappNumber) {
    return { ok: false, response: fail(400, INVALID_PHONE_MESSAGE) };
  }

  const conflicts = await findSignupConflicts(details.email, whatsappNumber);

  if (conflicts.taken) {
    return {
      ok: false,
      response: fail(409, ACCOUNT_EXISTS_MESSAGE),
    };
  }

  const sent = await sendVerificationCode(request, whatsappNumber, 'ACCOUNT');

  if (!sent.ok) {
    return sent;
  }

  return {
    ok: true,
    phone: toLocalPhone(whatsappNumber),
    record: sent.record,
    writes: (createUser) => [...deleteUnverifiedUsers(conflicts.staleUserIds), createUser, sent.logSend],
    info: sent.info,
  };
}

/** The answer when saving a new signup hit a unique or foreign-key conflict (someone signed up in between). */
export function signupWriteFailed(error: unknown) {
  if (errorCode(error) === 'P2002' || errorCode(error) === 'P2003') {
    return fail(409, ACCOUNT_EXISTS_MESSAGE);
  }

  throw error;
}

// ── Logging in before the number was confirmed ──────────────

/** The login answer for a correct password on an account whose number is still unconfirmed. */
export async function requireVerificationAtLogin(request: NextRequest, user: { id: string; phone: string | null }) {
  const message = 'Please confirm your WhatsApp number to log in.';
  const whatsappNumber = user.phone ? normalizePakistaniMobile(user.phone) : null;

  if (!whatsappNumber) {
    return fail(403, "This account's phone number can't receive WhatsApp codes. Please contact support.");
  }

  const now = new Date();
  const existing = await prisma.phoneVerification.findUnique({ where: { userId: user.id } });
  const sentSecondsAgo = existing ? (now.getTime() - existing.createdAt.getTime()) / 1000 : Infinity;

  // A code went out moments ago (they left the code screen and came back): that code still works, so give the
  // new screen a fresh ticket for it instead of sending another message.
  if (
    !usesFirebasePhone() &&
    existing &&
    existing.purpose === 'ACCOUNT' &&
    existing.phone === whatsappNumber &&
    existing.expiresAt > now &&
    existing.attempts < MAX_CODE_ATTEMPTS &&
    sentSecondsAgo < RESEND_COOLDOWN_SECONDS
  ) {
    const ticket = newTicket();

    await prisma.phoneVerification.update({ where: { id: existing.id }, data: { ticketHash: hashTicket(ticket) } });

    const verification: PhoneVerificationInfo = {
      ticket,
      phone: maskPhone(whatsappNumber),
      retryAfter: Math.max(1, Math.ceil(RESEND_COOLDOWN_SECONDS - sentSecondsAgo)),
    };

    return fail(403, message, { verification });
  }

  const sent = await sendVerificationCode(request, whatsappNumber, 'ACCOUNT');

  if (!sent.ok) {
    return sent.response;
  }

  await prisma.$transaction([
    prisma.phoneVerification.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...sent.record },
      update: sent.record,
    }),
    sent.logSend,
  ]);

  return fail(403, message, { verification: sent.info });
}

// ── Changing the number in Settings ─────────────────────────

/** Sends a code to the NEW number; the account keeps its old number until that code is entered. */
export async function startPhoneChange(
  request: NextRequest,
  userId: string,
  whatsappNumber: string,
  otherWrites: Prisma.PrismaPromise<unknown>[] = []
): Promise<{ ok: true; info: PhoneVerificationInfo } | { ok: false; response: NextResponse }> {
  const sent = await sendVerificationCode(request, whatsappNumber, 'CHANGE');

  if (!sent.ok) {
    return sent;
  }

  await prisma.$transaction([
    ...otherWrites,
    prisma.phoneVerification.upsert({ where: { userId }, create: { userId, ...sent.record }, update: sent.record }),
    sent.logSend,
  ]);

  return { ok: true, info: sent.info };
}

/** True when another account already uses this number, whatever way it was typed (the account itself is ignored). */
export async function isPhoneTakenByAnother(whatsappNumber: string, ownUserId: string) {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User"
    WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = ${whatsappNumber.slice(-10)}
      AND id <> ${ownUserId}
    LIMIT 1`;

  return rows.length > 0;
}

// ── Asking for another code, and entering one ───────────────

/** "Resend code" on the code screen: the same ticket gets a new code (subject to the send limits). */
export async function resendVerificationCode(request: NextRequest, ticket: string) {
  const row = await prisma.phoneVerification.findUnique({ where: { ticketHash: hashTicket(ticket) } });

  if (!row) {
    return fail(400, EXPIRED_VERIFICATION_MESSAGE, { restart: true });
  }

  const sent = await sendVerificationCode(request, row.phone, row.purpose, ticket);

  if (!sent.ok) {
    return sent.response;
  }

  await prisma.$transaction([prisma.phoneVerification.update({ where: { id: row.id }, data: sent.record }), sent.logSend]);

  return NextResponse.json({ verification: sent.info });
}

export type VerifyResult =
  | { ok: true; purpose: Purpose; user: VerifiedUser }
  | { ok: false; response: NextResponse };

type VerificationRow = {
  id: string;
  userId: string;
  purpose: Purpose;
  phone: string;
  user: VerifiedUser;
};

/** The number is proven: mark it confirmed (and, for a number change, store it), and drop the pending verification. */
async function confirmNumber(row: VerificationRow, now: Date): Promise<VerifyResult> {
  const newPhone = row.purpose === 'CHANGE' ? toLocalPhone(row.phone) : row.user.phone;

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: row.userId },
        data: { phoneVerifiedAt: now, ...(row.purpose === 'CHANGE' ? { phone: newPhone } : {}) },
      }),
      prisma.phoneVerification.deleteMany({ where: { id: row.id } }),
    ]);
  } catch (error) {
    if (errorCode(error) === 'P2002') {
      return { ok: false, response: fail(409, 'Another account already uses this phone number.') };
    }

    throw error;
  }

  return { ok: true, purpose: row.purpose, user: { ...row.user, phone: newPhone } };
}

/**
 * Firebase flow: the browser typed the SMS code into Firebase and sends the ID token Firebase answered with. It counts
 * as a try like a typed code does, and must prove exactly the number this verification is for.
 */
export async function verifyFirebaseToken(ticket: string, idToken: string, sessionUserId: string | null): Promise<VerifyResult> {
  const row = await prisma.phoneVerification.findUnique({
    where: { ticketHash: hashTicket(ticket) },
    include: { user: { select: { id: true, name: true, email: true, role: true, phone: true } } },
  });

  if (!row) {
    return { ok: false, response: fail(400, EXPIRED_VERIFICATION_MESSAGE, { restart: true }) };
  }

  if (row.purpose === 'CHANGE' && row.userId !== sessionUserId) {
    return { ok: false, response: fail(401, 'Please log in again to confirm your new number.') };
  }

  const now = new Date();

  if (row.expiresAt <= now) {
    return { ok: false, response: fail(400, 'This verification has expired. Tap “Resend code” to get a new one.') };
  }

  const counted = await prisma.phoneVerification.updateMany({
    where: { id: row.id, attempts: { lt: MAX_CODE_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });

  if (counted.count === 0) {
    return { ok: false, response: fail(429, 'Too many wrong codes. Tap “Resend code” to get a new one.') };
  }

  const proven = await verifyFirebasePhoneToken(idToken);

  if (!proven.ok) {
    return { ok: false, response: fail(400, proven.reason) };
  }

  if (proven.phone !== `+${row.phone}`) {
    return { ok: false, response: fail(400, 'That code was sent to a different number. Please start again.', { restart: true }) };
  }

  return confirmNumber(row, now);
}

/** Checks the code typed on the code screen and, when it is right, confirms the number. */
export async function verifyCode(ticket: string, code: string, sessionUserId: string | null): Promise<VerifyResult> {
  // With Firebase there is no code on our side to compare: the number is proven by Firebase's token instead.
  if (usesFirebasePhone()) {
    return { ok: false, response: fail(400, 'Please enter the code from the SMS we sent you.') };
  }

  const row = await prisma.phoneVerification.findUnique({
    where: { ticketHash: hashTicket(ticket) },
    include: { user: { select: { id: true, name: true, email: true, role: true, phone: true } } },
  });

  if (!row) {
    return { ok: false, response: fail(400, EXPIRED_VERIFICATION_MESSAGE, { restart: true }) };
  }

  // Switching the number of a logged-in account can only be confirmed from that account.
  if (row.purpose === 'CHANGE' && row.userId !== sessionUserId) {
    return { ok: false, response: fail(401, 'Please log in again to confirm your new number.') };
  }

  const now = new Date();

  if (row.expiresAt <= now) {
    return { ok: false, response: fail(400, 'This code has expired. Tap “Resend code” to get a new one.') };
  }

  // The try is counted before the code is compared, so parallel guesses cannot get past the limit.
  const counted = await prisma.phoneVerification.updateMany({
    where: { id: row.id, attempts: { lt: MAX_CODE_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });

  if (counted.count === 0) {
    return { ok: false, response: fail(429, 'Too many wrong codes. Tap “Resend code” to get a new one.') };
  }

  if (!sameHash(hashCode(row.phone, code), row.codeHash)) {
    const triesLeft = Math.max(0, MAX_CODE_ATTEMPTS - (row.attempts + 1));

    return {
      ok: false,
      response: fail(
        400,
        triesLeft > 0
          ? `That code isn't right. ${triesLeft} ${triesLeft === 1 ? 'try' : 'tries'} left.`
          : "That code isn't right. Tap “Resend code” to get a new one.",
        { triesLeft }
      ),
    };
  }

  return confirmNumber(row, now);
}
