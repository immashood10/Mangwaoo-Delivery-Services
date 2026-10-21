import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Request limits kept in the database (the site runs on several short-lived servers, so a counter in memory would
// not hold). One row per limit + person; the key is a SHA-256 hash, so no email or IP address is stored.

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

const CLEAN_UP_CHANCE = 0.02;
const KEEP_ROWS_FOR_SECONDS = 24 * 60 * 60;

function keyOf(scope: string, subject: string) {
  return crypto.createHash('sha256').update(`${scope}\u0000${subject}`).digest('hex');
}

/**
 * Counts one more request for `subject` (an IP address, an email, an account id…) under `scope` and says whether it is
 * still within `limit` requests per `windowSeconds`. The window starts at the first request and restarts when it is over.
 */
export async function consumeRateLimit(scope: string, subject: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const key = keyOf(scope, subject);

  // One statement, so two requests arriving together are both counted.
  const rows = await prisma.$queryRaw<{ count: number; retry: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart")
    VALUES (${key}, 1, now() AT TIME ZONE 'UTC')
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" < (now() AT TIME ZONE 'UTC') - make_interval(secs => ${windowSeconds}) THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" < (now() AT TIME ZONE 'UTC') - make_interval(secs => ${windowSeconds}) THEN now() AT TIME ZONE 'UTC' ELSE "RateLimit"."windowStart" END
    RETURNING "count",
      CEIL(EXTRACT(EPOCH FROM ("windowStart" + make_interval(secs => ${windowSeconds}) - (now() AT TIME ZONE 'UTC'))))::int AS "retry"
  `;

  // Old rows are only useful for a little while.
  if (Math.random() < CLEAN_UP_CHANCE) {
    void prisma.$executeRaw`DELETE FROM "RateLimit" WHERE "windowStart" < (now() AT TIME ZONE 'UTC') - make_interval(secs => ${KEEP_ROWS_FOR_SECONDS})`.catch(() => {});
  }

  const row = rows[0];

  if (row && Number(row.count) > limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Number(row.retry) || windowSeconds) };
  }

  return { allowed: true };
}

export type LimitRule = { scope: string; subject: string | null | undefined; limit: number; windowSeconds: number };

/**
 * Applies several limits (for example one per IP and one per email) and returns the "429 Too many requests" answer
 * to send when any of them is used up, or null when the request may go ahead. A rule without a subject (an unknown
 * IP address) is skipped.
 */
export async function enforceRateLimits(rules: LimitRule[], message = 'Too many attempts. Please wait a little and try again.') {
  let worstWait = 0;

  for (const rule of rules) {
    if (!rule.subject) continue;

    const result = await consumeRateLimit(rule.scope, rule.subject, rule.limit, rule.windowSeconds);

    if (!result.allowed) worstWait = Math.max(worstWait, result.retryAfterSeconds);
  }

  if (worstWait === 0) return null;

  return NextResponse.json({ error: message, retryAfter: worstWait }, { status: 429, headers: { 'Retry-After': String(worstWait) } });
}
