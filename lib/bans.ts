import type { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { DELETED_NOTICE, banNotice, type AccountNotice, type BanSummary } from '@/lib/ban-duration';

// Bans and deleted accounts (Admin > Users). A session cookie lasts 30 days, so being banned has to be noticed on
// every request: getSession() asks `getRestriction()` below, which answers from a short-lived in-memory list of the
// accounts that are banned or deleted (a handful of rows, reloaded every few seconds). A ban therefore ends the
// person's session within seconds on every server instance, without a database read on each request.

export type Restriction = { kind: 'BANNED'; ban: BanSummary } | { kind: 'DELETED' };

const SNAPSHOT_TTL_MS = 15_000;
const RETRY_AFTER_FAILURE_MS = 5_000;

type Snapshot = {
  loadedAt: number;
  restrictions: Map<string, Restriction>;
  /** Per account: cookies issued before this second (seconds since 1970) are void because the password changed. */
  sessionsValidFrom: Map<string, number>;
};

// A cookie lasts at most 30 days, so a password change older than that no longer matters.
const SESSION_MAX_AGE_MS = 31 * 24 * 60 * 60 * 1000;

// On globalThis so every compiled copy of this module (Next dev has several) shares one list.
const shared = globalThis as unknown as { banSnapshot?: Snapshot; banSnapshotLoading?: Promise<Snapshot> };

/** Bans that are in force at `now`: not lifted, and either permanent or not yet over. */
export function activeBanWhere(now = new Date()): Prisma.UserBanWhereInput {
  return { liftedAt: null, OR: [{ permanent: true }, { endsAt: { gt: now } }] };
}

export function toBanSummary(ban: { permanent: boolean; durationLabel: string; endsAt: Date | null; reason: string | null }): BanSummary {
  return { permanent: ban.permanent, durationLabel: ban.durationLabel, endsAt: ban.endsAt, reason: ban.reason };
}

async function loadSnapshot(): Promise<Snapshot> {
  const [bans, deleted, resets] = await Promise.all([
    prisma.userBan.findMany({ where: activeBanWhere(), orderBy: { createdAt: 'asc' } }),
    prisma.user.findMany({ where: { deletedAt: { not: null } }, select: { id: true } }),
    prisma.user.findMany({ where: { sessionsValidFrom: { gt: new Date(Date.now() - SESSION_MAX_AGE_MS) } }, select: { id: true, sessionsValidFrom: true } }),
  ]);

  const restrictions = new Map<string, Restriction>();

  // A newer ban on the same account replaces an older one that is somehow still open.
  for (const ban of bans) restrictions.set(ban.userId, { kind: 'BANNED', ban: toBanSummary(ban) });
  for (const user of deleted) restrictions.set(user.id, { kind: 'DELETED' });

  const sessionsValidFrom = new Map<string, number>();
  for (const user of resets) {
    if (user.sessionsValidFrom) sessionsValidFrom.set(user.id, Math.floor(user.sessionsValidFrom.getTime() / 1000));
  }

  return { loadedAt: Date.now(), restrictions, sessionsValidFrom };
}

function snapshot(): Promise<Snapshot> {
  const current = shared.banSnapshot;

  if (current && Date.now() - current.loadedAt < SNAPSHOT_TTL_MS) return Promise.resolve(current);

  // One reload at a time, however many requests are waiting for it.
  if (!shared.banSnapshotLoading) {
    shared.banSnapshotLoading = loadSnapshot()
      .then((fresh) => {
        shared.banSnapshot = fresh;
        return fresh;
      })
      .catch((error) => {
        // The database can't be reached: keep what was known and try again in a moment. Nobody is locked out by an outage.
        console.error('Could not load the list of banned accounts:', error);
        const stale: Snapshot = { loadedAt: Date.now() - SNAPSHOT_TTL_MS + RETRY_AFTER_FAILURE_MS, restrictions: current?.restrictions ?? new Map(), sessionsValidFrom: current?.sessionsValidFrom ?? new Map() };
        shared.banSnapshot = stale;
        return stale;
      })
      .finally(() => {
        shared.banSnapshotLoading = undefined;
      });
  }

  return shared.banSnapshotLoading;
}

/** Why this account may not be used right now (banned, or deleted), or null when it is fine. */
export async function getRestriction(userId: string): Promise<Restriction | null> {
  const restriction = (await snapshot()).restrictions.get(userId);

  if (!restriction) return null;

  // A temporary ban ends by itself between two reloads of the list.
  if (restriction.kind === 'BANNED' && !restriction.ban.permanent && restriction.ban.endsAt && restriction.ban.endsAt.getTime() <= Date.now()) {
    return null;
  }

  return restriction;
}

/** True when the cookie was issued before this account's password was last changed or reset. */
export async function isSessionRevoked(userId: string, issuedAtSeconds: number | undefined) {
  const validFrom = (await snapshot()).sessionsValidFrom.get(userId);

  if (validFrom === undefined) return false;

  return (issuedAtSeconds ?? 0) < validFrom;
}

/** Makes the next request reload the list: call it right after a ban is made or lifted so this server notices at once. */
export function invalidateBanSnapshot() {
  shared.banSnapshot = undefined;
}

/** The ban in force on an account, read straight from the database (for login, where freshness matters more than speed). */
export async function findActiveBan(userId: string): Promise<BanSummary | null> {
  const ban = await prisma.userBan.findFirst({ where: { userId, ...activeBanWhere() }, orderBy: { createdAt: 'desc' } });

  return ban ? toBanSummary(ban) : null;
}

export function restrictionNotice(restriction: Restriction): AccountNotice {
  return restriction.kind === 'BANNED' ? banNotice(restriction.ban) : DELETED_NOTICE;
}
