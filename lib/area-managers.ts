import { NextResponse } from 'next/server';
import type { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { getSession, hashPassword } from '@/lib/auth';
import { invalidateBanSnapshot } from '@/lib/bans';
import { distanceInKm, isRealLocation, type Coordinates } from '@/lib/geo';
import { notifyAfterResponse } from '@/lib/notify';
import { ASM_PAGES } from '@/lib/notification-types';
import { RIDER_ONLINE_WINDOW_MS } from '@/lib/rider-dispatch';
import { getRiderRatings } from '@/lib/rider-orders';
import { riderChatMessagePreview } from '@/lib/rider-chat-types';
import { deliveryChargeForChat, riderHold } from '@/lib/rider-wallet-config';
import { passwordProblem } from '@/lib/password-policy';
import { normalizePakistaniMobile, toLocalPhone } from '@/lib/phone';
import { isSuperAdminLogin } from '@/lib/super-admin';
import { SERVICE_AREAS } from '@/lib/data';
import {
  ASM_FINISHED_VISIBLE_MS,
  MANAGER_LOGIN_MAX,
  MANAGER_LOGIN_MIN,
  MANAGER_NAME_MAX,
  MANAGER_NAME_MIN,
  areaForPoint,
  areaName,
  isServiceAreaId,
  normalizeManagerLogin,
  type AssignableRider,
  type ManagerChatRow,
  type ManagerRow,
} from '@/lib/area-managers-config';

// Area Sales Managers (see lib/area-managers-config.ts for the idea). The account is a `User` with role ASM plus one
// `AreaManager` row naming the service area; the super admin makes and removes them (Admin > Area Managers).
//
// Which order chats are a manager's: the ones with `RiderChat.areaId` = their area. Such a chat is made when a customer
// starts an order with the Chat button and the customer's area has a manager (`managedAreaFor`). While it is OPEN riders
// do not see it (the manager picks one and `assignRiderToChat` makes it ACTIVE with that rider); every other chat is
// "first rider to reply" as before. If an area loses its last manager its running chats go back to that old way.

type Tx = Prisma.TransactionClient;

const TRANSACTION_OPTIONS = { timeout: 20000, maxWait: 10000 } as const;
const MANAGER_CHAT_LIMIT = 150;
const MANAGER_RIDER_LIMIT = 80;

const LIVE_MANAGER_USER = { deletedAt: null, isActive: true } as const;

// ── Who is who ────────────────────────────────────────────

/** The areas (SERVICE_AREAS ids) that have at least one active manager. */
export async function areasWithManagers(): Promise<number[]> {
  const rows = await prisma.areaManager.findMany({
    where: { user: LIVE_MANAGER_USER },
    select: { areaId: true },
    distinct: ['areaId'],
  });

  return rows.map((row) => row.areaId);
}

/** The area whose manager gets an order delivered to `point`; null = nobody manages it (riders take it first-come). */
export async function managedAreaFor(point: Coordinates): Promise<number | null> {
  if (!isRealLocation(point)) return null;

  return areaForPoint(point, await areasWithManagers());
}

export type ManagerIdentity = { managerId: string; userId: string; name: string; areaId: number; areaName: string };

/** The manager behind a logged-in user id; null when there is none or the account is gone. */
export async function findManager(userId: string): Promise<ManagerIdentity | null> {
  const row = await prisma.areaManager.findUnique({
    where: { userId },
    select: { id: true, areaId: true, user: { select: { name: true, isActive: true, deletedAt: true } } },
  });

  if (!row || row.user.deletedAt || !row.user.isActive) return null;

  return { managerId: row.id, userId, name: row.user.name, areaId: row.areaId, areaName: areaName(row.areaId) ?? 'Unknown area' };
}

/** For the manager's API routes: the logged-in manager, or the answer to send back. */
export async function requireManager(): Promise<{ manager: ManagerIdentity } | { error: NextResponse }> {
  const session = await getSession();

  if (!session || session.role !== 'ASM') {
    return { error: NextResponse.json({ error: 'You must be logged in as an area manager to do this.' }, { status: 401 }) };
  }

  const manager = await findManager(session.userId);

  if (!manager) {
    return { error: NextResponse.json({ error: 'Your area manager account is not active.' }, { status: 403 }) };
  }

  return { manager };
}

/** For the super admin's API routes: the signed-in super admin's id, or the answer to send back. */
export async function requireSuperAdmin(): Promise<{ adminId: string } | { error: NextResponse }> {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return { error: NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 }) };
  }

  const admin = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true } });

  if (!isSuperAdminLogin(admin?.email)) {
    return { error: NextResponse.json({ error: 'Only the super admin can manage area managers.' }, { status: 403 }) };
  }

  return { adminId: session.userId };
}

// ── The managers (super admin) ────────────────────────────

export type NewManager = { name: string; login: string; phone: string | null; password: string; areaId: number };

function cleanName(raw: unknown) {
  return typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
}

const NAME_PROBLEM = `Please enter the manager's name (${MANAGER_NAME_MIN} to ${MANAGER_NAME_MAX} characters).`;

/** Reads the super admin's "new manager" form; answers with what to store, or what is wrong with it. */
export function parseNewManager(body: unknown): { input: NewManager } | { error: string } {
  const data = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const name = cleanName(data.name);

  if (name.length < MANAGER_NAME_MIN || name.length > MANAGER_NAME_MAX) return { error: NAME_PROBLEM };

  const login = normalizeManagerLogin(data.login);

  if (!login) {
    return { error: `The login name must be ${MANAGER_LOGIN_MIN} to ${MANAGER_LOGIN_MAX} characters: letters, numbers and . _ @ + - only.` };
  }

  if (!isServiceAreaId(data.areaId)) return { error: 'Please choose the area this manager looks after.' };

  const password = typeof data.password === 'string' ? data.password : '';
  const problem = passwordProblem(password, [name, login]);

  if (problem) return { error: problem };

  let phone: string | null = null;

  if (typeof data.phone === 'string' && data.phone.trim()) {
    const normalized = normalizePakistaniMobile(data.phone.trim());

    if (!normalized) return { error: 'That phone number is not a Pakistani mobile number.' };

    phone = toLocalPhone(normalized);
  }

  return { input: { name, login, phone, password, areaId: data.areaId } };
}

/** Reads the super admin's "change manager" form: any of a new area, a new password, a new name (at least one). */
export function parseManagerChange(body: unknown, login: string): { patch: { areaId?: number; password?: string; name?: string } } | { error: string } {
  const data = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const patch: { areaId?: number; password?: string; name?: string } = {};

  if (data.areaId !== undefined) {
    if (!isServiceAreaId(data.areaId)) return { error: 'Please choose the area this manager looks after.' };

    patch.areaId = data.areaId;
  }

  if (data.name !== undefined) {
    const name = cleanName(data.name);

    if (name.length < MANAGER_NAME_MIN || name.length > MANAGER_NAME_MAX) return { error: NAME_PROBLEM };

    patch.name = name;
  }

  if (data.password !== undefined) {
    const password = typeof data.password === 'string' ? data.password : '';
    const problem = passwordProblem(password, [patch.name ?? '', login]);

    if (problem) return { error: problem };

    patch.password = password;
  }

  if (Object.keys(patch).length === 0) return { error: 'Nothing to change.' };

  return { patch };
}

export async function listManagers(): Promise<ManagerRow[]> {
  const [rows, counts] = await Promise.all([
    prisma.areaManager.findMany({
      where: { user: { deletedAt: null } },
      orderBy: [{ areaId: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, userId: true, areaId: true, createdAt: true, user: { select: { name: true, email: true, phone: true } } },
    }),
    prisma.riderChat.groupBy({
      by: ['areaId', 'status'],
      where: { areaId: { not: null }, status: { in: ['OPEN', 'ACTIVE'] } },
      _count: { _all: true },
    }),
  ]);

  return rows.map((row) => {
    const mine = counts.filter((count) => count.areaId === row.areaId);

    return {
      id: row.id,
      userId: row.userId,
      name: row.user.name,
      login: row.user.email,
      phone: row.user.phone,
      areaId: row.areaId,
      areaName: areaName(row.areaId) ?? 'Unknown area',
      createdAt: row.createdAt.toISOString(),
      openChats: mine.reduce((sum, count) => sum + count._count._all, 0),
      waitingChats: mine.filter((count) => count.status === 'OPEN').reduce((sum, count) => sum + count._count._all, 0),
    };
  });
}

export type ManagerWriteResult = { ok: true; manager: ManagerRow } | { ok: false; status: number; error: string };

async function managerRow(id: string): Promise<ManagerRow | null> {
  return (await listManagers()).find((manager) => manager.id === id) ?? null;
}

/** Makes a manager account for an area. The account can log in at once (no code to confirm). */
export async function createManager(input: {
  name: string;
  login: string;
  phone: string | null;
  password: string;
  areaId: number;
}): Promise<ManagerWriteResult> {
  const taken = await prisma.user.findFirst({
    where: { OR: [{ email: input.login }, ...(input.phone ? [{ phone: input.phone }] : [])] },
    select: { email: true },
  });

  if (taken) {
    return {
      ok: false,
      status: 409,
      error: taken.email === input.login ? 'That login name is already used by another account.' : 'That phone number is already used by another account.',
    };
  }

  try {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.login,
        phone: input.phone,
        password: await hashPassword(input.password),
        role: 'ASM',
        // Made by the super admin, so there is no number to confirm.
        phoneVerifiedAt: new Date(),
        areaManager: { create: { areaId: input.areaId } },
      },
      select: { areaManager: { select: { id: true } } },
    });
    const created = user.areaManager ? await managerRow(user.areaManager.id) : null;

    if (!created) return { ok: false, status: 500, error: 'The manager was made but could not be read back. Please reload.' };

    return { ok: true, manager: created };
  } catch (error) {
    // Two people making the same login at once: the database's unique rule decides.
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return { ok: false, status: 409, error: 'That login name or phone number is already used by another account.' };
    }

    throw error;
  }
}

/** Changes a manager: a new area, a new password (their old logins end), a new name. Chats of an area left without a manager go back to the riders. */
export async function updateManager(
  id: string,
  patch: { areaId?: number; password?: string; name?: string }
): Promise<ManagerWriteResult> {
  const existing = await prisma.areaManager.findUnique({ where: { id }, select: { userId: true, areaId: true, user: { select: { deletedAt: true } } } });

  if (!existing || existing.user.deletedAt) return { ok: false, status: 404, error: 'Area manager not found.' };

  const passwordHash = patch.password ? await hashPassword(patch.password) : null;

  await prisma.$transaction(async (tx) => {
    if (patch.areaId !== undefined && patch.areaId !== existing.areaId) {
      await tx.areaManager.update({ where: { id }, data: { areaId: patch.areaId } });
      await releaseUncoveredAreaChats(tx, existing.areaId);
    }

    if (patch.name !== undefined || passwordHash) {
      await tx.user.update({
        where: { id: existing.userId },
        data: {
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          // Every older login of this account ends; the new password is the only way back in.
          ...(passwordHash ? { password: passwordHash, sessionsValidFrom: new Date() } : {}),
        },
      });
    }
  }, TRANSACTION_OPTIONS);

  if (passwordHash) invalidateBanSnapshot();

  const updated = await managerRow(id);

  return updated ? { ok: true, manager: updated } : { ok: false, status: 404, error: 'Area manager not found.' };
}

/**
 * When an area has no active manager left, its chats that are going go back to "first rider to reply" (areaId cleared),
 * so no order waits for a manager who is not there. Returns how many chats were released. Call after the manager's row
 * is gone or moved.
 */
export async function releaseUncoveredAreaChats(client: Tx | typeof prisma, areaId: number): Promise<number> {
  const left = await client.areaManager.count({ where: { areaId, user: LIVE_MANAGER_USER } });

  if (left > 0) return 0;

  const released = await client.riderChat.updateMany({ where: { areaId, status: { in: ['OPEN', 'ACTIVE'] } }, data: { areaId: null } });

  return released.count;
}

/** An admin hands a waiting order to the riders (the first to reply takes it), e.g. when the manager is not answering. */
export async function releaseChatToRiders(chatId: string): Promise<'released' | 'missing' | 'not-waiting'> {
  const updated = await prisma.riderChat.updateMany({ where: { id: chatId, status: 'OPEN', riderId: null, areaId: { not: null } }, data: { areaId: null } });

  if (updated.count === 1) return 'released';

  const exists = await prisma.riderChat.findUnique({ where: { id: chatId }, select: { id: true } });

  return exists ? 'not-waiting' : 'missing';
}

// ── The manager's orders ──────────────────────────────────

/** The order chats of an area for the manager's screen: the ones going, and those finished in the last day. */
export async function listManagerChats(areaId: number): Promise<ManagerChatRow[]> {
  const finishedSince = new Date(Date.now() - ASM_FINISHED_VISIBLE_MS);
  const chats = await prisma.riderChat.findMany({
    where: { areaId, OR: [{ status: { in: ['OPEN', 'ACTIVE'] } }, { status: 'CLOSED', updatedAt: { gte: finishedSince } }] },
    orderBy: { updatedAt: 'desc' },
    take: MANAGER_CHAT_LIMIT,
    include: {
      customer: { include: { user: { select: { name: true } } } },
      rider: { include: { user: { select: { name: true } } } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  return chats.map((chat) => ({
    id: chat.id,
    status: chat.status,
    customerName: chat.customer.user.name,
    riderId: chat.riderId,
    riderName: chat.rider?.user.name ?? null,
    addressText: chat.addressText,
    pickupText: chat.pickupText,
    lat: chat.latitude,
    lng: chat.longitude,
    pickupLat: chat.pickupLatitude,
    pickupLng: chat.pickupLongitude,
    deliveryCharge: deliveryChargeForChat({
      deliveryCharge: chat.deliveryCharge,
      lat: chat.latitude,
      lng: chat.longitude,
      pickupLat: chat.pickupLatitude,
      pickupLng: chat.pickupLongitude,
    }),
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString(),
    lastMessage: chat.messages[0] ? riderChatMessagePreview(chat.messages[0]) : null,
    lastMessageFrom: chat.messages[0]?.senderRole ?? null,
  }));
}

/** The area's centre, which riders are measured from when no order is picked. */
export function areaCentre(areaId: number): Coordinates | null {
  return SERVICE_AREAS.find((area) => area.id === areaId)?.coordinates ?? null;
}

/**
 * The riders a manager can pick from, online ones first and nearest first. `from` is the order's pickup point (or the area's
 * centre). A rider who has to pay first (or is blocked) is listed but cannot be picked: that is the wallet rule, here too.
 */
export async function listAssignableRiders(from: Coordinates | null): Promise<AssignableRider[]> {
  const onlineSince = Date.now() - RIDER_ONLINE_WINDOW_MS;
  const riders = await prisma.rider.findMany({
    where: { isApproved: true, user: LIVE_MANAGER_USER },
    select: {
      id: true,
      vehicleType: true,
      isAvailable: true,
      lastSeenAt: true,
      lastLatitude: true,
      lastLongitude: true,
      orderAccess: true,
      paymentHold: true,
      unpaidOrders: true,
      user: { select: { name: true } },
    },
    take: 300,
  });
  const ids = riders.map((rider) => rider.id);
  const [busy, ratings] = await Promise.all([
    prisma.riderChat.groupBy({ by: ['riderId'], where: { riderId: { in: ids }, status: 'ACTIVE' }, _count: { _all: true } }),
    getRiderRatings(ids),
  ]);
  const activeByRider = new Map(busy.flatMap((row) => (row.riderId ? [[row.riderId, row._count._all] as const] : [])));

  const rows = riders.map((rider) => {
    const online = rider.isAvailable && rider.lastSeenAt !== null && rider.lastSeenAt.getTime() >= onlineSince;
    const position = rider.lastLatitude !== null && rider.lastLongitude !== null ? { lat: rider.lastLatitude, lng: rider.lastLongitude } : null;
    const distanceKm = from && position ? Math.round(distanceInKm(from, position) * 10) / 10 : null;
    const hold = riderHold(rider);
    const reason = hold === 'PAYMENT' ? 'Must pay Mangwaoo first' : hold === 'ADMIN' ? 'Blocked by Mangwaoo' : !online ? 'Offline' : null;
    const row: AssignableRider = {
      id: rider.id,
      name: rider.user.name,
      vehicleType: rider.vehicleType,
      online,
      distanceKm,
      activeOrders: activeByRider.get(rider.id) ?? 0,
      unpaidOrders: rider.unpaidOrders,
      rating: ratings.get(rider.id) ?? null,
      hold,
      canAssign: online && hold === null,
      reason,
    };

    return { row, lastSeen: rider.lastSeenAt?.getTime() ?? 0 };
  });

  // Online riders first, the nearest first (those whose position is unknown last); then the others, seen most recently first.
  rows.sort((a, b) => {
    if (a.row.online !== b.row.online) return a.row.online ? -1 : 1;
    if (a.row.online) {
      if (a.row.distanceKm !== b.row.distanceKm) return (a.row.distanceKm ?? Infinity) - (b.row.distanceKm ?? Infinity);
    } else if (a.lastSeen !== b.lastSeen) {
      return b.lastSeen - a.lastSeen;
    }

    return a.row.name.localeCompare(b.row.name);
  });

  return rows.slice(0, MANAGER_RIDER_LIMIT).map((entry) => entry.row);
}

export type AssignOutcome =
  | {
      kind: 'assigned';
      chatId: string;
      customerUserId: string;
      customerName: string;
      riderUserId: string;
      riderName: string;
      /** The rider this order was taken from, when the manager changed the rider of an order that already had one. */
      previousRiderUserId: string | null;
      addressText: string;
      pickupText: string | null;
    }
  | { kind: 'missing' }
  | { kind: 'not-managed' }
  | { kind: 'closed' }
  | { kind: 'same-rider' }
  | { kind: 'rider-unavailable'; error: string };

/**
 * A manager gives an order of their area to a rider: the chat becomes ACTIVE with that rider (or, when it already had one,
 * moves to the new rider). The chat row is locked first (a customer cancelling or a rider completing at the same moment
 * can't both win) and then the rider's row, the order the wallet code locks in too. The rider must be approved, online and
 * not on hold: unpaid commission up to the limit (or an admin's block) means no new order, whoever offers it.
 */
export async function assignRiderToChat(input: { chatId: string; riderId: string; areaId: number }): Promise<AssignOutcome> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ status: string; areaId: number | null; riderId: string | null }[]>`
      SELECT "status"::text AS "status", "areaId", "riderId" FROM "RiderChat" WHERE "id" = ${input.chatId} FOR UPDATE`;

    if (locked.length === 0) return { kind: 'missing' } as const;

    const row = locked[0];

    // Another area's order (or one nobody manages) is not theirs to give away; the answer is the same as "not there".
    if (row.areaId !== input.areaId) return { kind: 'not-managed' } as const;
    if (row.status === 'CLOSED') return { kind: 'closed' } as const;
    if (row.riderId === input.riderId) return { kind: 'same-rider' } as const;

    await tx.$queryRaw`SELECT "id" FROM "Rider" WHERE "id" = ${input.riderId} FOR UPDATE`;

    const rider = await tx.rider.findUnique({
      where: { id: input.riderId },
      select: {
        userId: true,
        isApproved: true,
        isAvailable: true,
        lastSeenAt: true,
        orderAccess: true,
        paymentHold: true,
        user: { select: { name: true, isActive: true, deletedAt: true } },
      },
    });

    if (!rider || !rider.isApproved || rider.user.deletedAt || !rider.user.isActive) {
      return { kind: 'rider-unavailable', error: 'That rider cannot take orders.' } as const;
    }

    const hold = riderHold(rider);

    if (hold === 'PAYMENT') {
      return { kind: 'rider-unavailable', error: `${rider.user.name} must pay Mangwaoo first, so cannot get a new order yet.` } as const;
    }

    if (hold === 'ADMIN') {
      return { kind: 'rider-unavailable', error: `Mangwaoo has put ${rider.user.name} on hold, so cannot get a new order.` } as const;
    }

    const isOnline = rider.isAvailable && rider.lastSeenAt !== null && rider.lastSeenAt.getTime() >= Date.now() - RIDER_ONLINE_WINDOW_MS;

    if (!isOnline) return { kind: 'rider-unavailable', error: `${rider.user.name} is offline right now.` } as const;

    const previous = row.riderId
      ? await tx.rider.findUnique({ where: { id: row.riderId }, select: { userId: true } })
      : null;

    await tx.riderChat.update({ where: { id: input.chatId }, data: { riderId: input.riderId, status: 'ACTIVE', claimedAt: new Date() } });

    const chat = await tx.riderChat.findUnique({
      where: { id: input.chatId },
      select: { addressText: true, pickupText: true, customer: { select: { userId: true, user: { select: { name: true } } } } },
    });

    if (!chat) return { kind: 'missing' } as const;

    return {
      kind: 'assigned',
      chatId: input.chatId,
      customerUserId: chat.customer.userId,
      customerName: chat.customer.user.name,
      riderUserId: rider.userId,
      riderName: rider.user.name,
      previousRiderUserId: previous?.userId ?? null,
      addressText: chat.addressText,
      pickupText: chat.pickupText,
    } as const;
  }, TRANSACTION_OPTIONS);
}

// ── Telling the managers ──────────────────────────────────

/** The user ids of an area's active managers. */
export async function managerUserIds(areaId: number): Promise<string[]> {
  const rows = await prisma.areaManager.findMany({ where: { areaId, user: LIVE_MANAGER_USER }, select: { userId: true } });

  return rows.map((row) => row.userId);
}

/** Puts a notice in the bell (and on the phone) of every manager of an area, after the response has gone out. */
export function notifyAreaManagers(areaId: number, notice: { title: string; message: string; refId?: string }) {
  notifyAfterResponse(async () =>
    (await managerUserIds(areaId)).map((userId) => ({
      userId,
      type: 'ORDER' as const,
      title: notice.title,
      message: notice.message,
      href: ASM_PAGES.orders,
      refId: notice.refId,
    }))
  );
}
