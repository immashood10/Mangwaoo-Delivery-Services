import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { getRestriction, isSessionRevoked } from '@/lib/bans';

const SESSION_COOKIE_NAME = 'mangwaoo_session';
const REMEMBERED_SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 days
const DEFAULT_SESSION_DURATION_SECONDS = 60 * 60 * 24; // 1 day
const BCRYPT_COST = 12;

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error('AUTH_SECRET environment variable is not set');
  }

  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  userId: string;
  role: 'CUSTOMER' | 'SELLER' | 'RIDER' | 'ADMIN';
  /** When the cookie was issued (seconds since 1970); added by the token itself. */
  iat?: number;
};

export function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_COST);
}

let dummyHash: Promise<string> | undefined;

/**
 * Checks a password against an account's hash. With no account (unknown email) it still does the same amount of work
 * against a throw-away hash, so "no such account" and "wrong password" take equally long and answer the same.
 */
export async function verifyPasswordOrDummy(password: string, passwordHash: string | null | undefined) {
  if (passwordHash) return bcrypt.compare(password, passwordHash);

  dummyHash ??= bcrypt.hash('not-a-real-password', BCRYPT_COST);
  await bcrypt.compare(password, await dummyHash);

  return false;
}

export function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function createSession(payload: SessionPayload, remember: boolean = true) {
  const durationSeconds = remember ? REMEMBERED_SESSION_DURATION_SECONDS : DEFAULT_SESSION_DURATION_SECONDS;

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${durationSeconds}s`)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // Omitting maxAge makes it a session cookie that clears when the browser closes.
    ...(remember ? { maxAge: durationSeconds } : {}),
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/** What the session cookie says, without asking whether the account was banned or deleted since. */
export async function readSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    // Only tokens signed the way this site signs them are accepted.
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ['HS256'] });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * The logged-in account, or null. A banned or deleted account counts as logged out even though its cookie is still
 * valid for weeks, so a ban ends the person's session on their very next request.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const session = await readSession();

  if (!session) {
    return null;
  }

  if (await getRestriction(session.userId)) return null;

  // Cookies issued before the password was last changed or reset are no longer valid.
  return (await isSessionRevoked(session.userId, session.iat)) ? null : session;
}
