import crypto from 'crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

// A visitor is an anonymous browser. Its cookie holds a random token; the database row is keyed by the
// token's hash, so the cookie is the only thing the browser keeps and everything else lives in the database.

const VISITOR_COOKIE_NAME = 'mangwaoo_visitor';
const VISITOR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const STALE_VISITOR_DAYS = 365;
const PURGE_ONE_IN = 50;

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

/** The id this request's visitor row has (or would have), worked out from the cookie alone with no database read; null without a cookie. */
export async function getVisitorId() {
  const token = (await cookies()).get(VISITOR_COOKIE_NAME)?.value;

  return token ? hashToken(token) : null;
}

/** The visitor behind this request, or null for a browser that has never been recorded. Never creates one. */
export async function getVisitor() {
  const token = (await cookies()).get(VISITOR_COOKIE_NAME)?.value;

  if (!token) return null;

  return prisma.visitor.findUnique({ where: { id: hashToken(token) } });
}

/** The visitor behind this request; a new one is recorded (and its cookie set) the first time. */
export async function getOrCreateVisitor() {
  const cookieStore = await cookies();
  const token = cookieStore.get(VISITOR_COOKIE_NAME)?.value;

  if (token) {
    const existing = await prisma.visitor.findUnique({ where: { id: hashToken(token) } });
    if (existing) return existing;
  }

  const newToken = crypto.randomBytes(24).toString('base64url');
  const visitor = await prisma.visitor.create({ data: { id: hashToken(newToken) } });

  cookieStore.set(VISITOR_COOKIE_NAME, newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: VISITOR_COOKIE_MAX_AGE_SECONDS,
  });

  // Keep the table small on a public site: now and then, drop visitors that haven't been back for a year.
  if (Math.floor(Math.random() * PURGE_ONE_IN) === 0) {
    const cutoff = new Date(Date.now() - STALE_VISITOR_DAYS * 24 * 60 * 60 * 1000);
    void prisma.visitor.deleteMany({ where: { lastSeenAt: { lt: cutoff } } }).catch(() => undefined);
  }

  return visitor;
}
