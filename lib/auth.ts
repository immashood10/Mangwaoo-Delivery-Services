import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { getRestriction } from '@/lib/bans';

const SESSION_COOKIE_NAME = 'mangwaoo_session';
const REMEMBERED_SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 days
const DEFAULT_SESSION_DURATION_SECONDS = 60 * 60 * 24; // 1 day

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
};

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
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
    const { payload } = await jwtVerify(token, getSecretKey());
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

  return (await getRestriction(session.userId)) ? null : session;
}
