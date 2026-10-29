// Area Sales Managers (ASM): what the API routes, the manager's dashboard and the super admin's page share (client-safe,
// no database).
//
// How it works: the super admin makes a manager account for a service area (`SERVICE_AREAS` in lib/data.ts). An order a
// customer starts with the Chat button goes to the manager of the customer's area (the nearest area that has one), who
// picks the rider and assigns the order to them. Orders from a checkout (the cart) are not theirs: the first rider to
// reply takes those, as before. An area without a manager works the old way for its chat orders too.

import { SERVICE_AREAS } from '@/lib/data';
import { distanceInKm, type Coordinates } from '@/lib/geo';

export type AreaOption = { id: number; name: string };

export const AREA_OPTIONS: AreaOption[] = SERVICE_AREAS.map(({ id, name }) => ({ id, name }));

/**
 * An order delivered farther than this from the centre of every area that has a manager is not managed: the first rider to
 * reply takes it, as in an area without a manager.
 */
export const ASM_MAX_DISTANCE_KM = 10;

/** How long a finished (closed) order stays in the manager's list. */
export const ASM_FINISHED_VISIBLE_MS = 24 * 60 * 60 * 1000;

export const MANAGER_NAME_MIN = 2;
export const MANAGER_NAME_MAX = 60;
export const MANAGER_LOGIN_MIN = 3;
export const MANAGER_LOGIN_MAX = 60;
/** A manager logs in with a short name or an email address: letters, digits and . _ @ + - */
export const MANAGER_LOGIN_PATTERN = /^[a-z0-9._@+-]+$/;

export function areaName(areaId: number | null | undefined) {
  return SERVICE_AREAS.find((area) => area.id === areaId)?.name ?? null;
}

export function isServiceAreaId(value: unknown): value is number {
  return typeof value === 'number' && SERVICE_AREAS.some((area) => area.id === value);
}

/**
 * The area whose manager gets an order delivered to `point`: the nearest area among `coveredAreaIds` (those that have a
 * manager), when it is within `ASM_MAX_DISTANCE_KM`. null = nobody manages it, riders take it first-come.
 */
export function areaForPoint(point: Coordinates, coveredAreaIds: readonly number[]): number | null {
  let best: { id: number; km: number } | null = null;

  for (const area of SERVICE_AREAS) {
    if (!coveredAreaIds.includes(area.id)) continue;

    const km = distanceInKm(point, area.coordinates);
    if (!best || km < best.km) best = { id: area.id, km };
  }

  return best && best.km <= ASM_MAX_DISTANCE_KM ? best.id : null;
}

/** What a customer and a rider read above a manager's message: the first name and the company. */
export function managerSenderName(name: string) {
  const first = name.trim().split(/\s+/)[0];

  return `${first || 'Area manager'} · Mangwaoo`;
}

/** The login name as it is stored: trimmed and lower case. Null when it cannot be one. */
export function normalizeManagerLogin(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;

  const login = raw.trim().toLowerCase();

  return login.length >= MANAGER_LOGIN_MIN && login.length <= MANAGER_LOGIN_MAX && MANAGER_LOGIN_PATTERN.test(login) ? login : null;
}

/** One manager as the super admin's page lists them. */
export type ManagerRow = {
  id: string;
  userId: string;
  name: string;
  login: string;
  phone: string | null;
  areaId: number;
  areaName: string;
  createdAt: string;
  /** Order chats of this manager's area that are going (waiting for a rider, or with one). */
  openChats: number;
  waitingChats: number;
};

/** One order chat as the manager's screen lists it. */
export type ManagerChatRow = {
  id: string;
  status: 'OPEN' | 'ACTIVE' | 'CLOSED';
  customerName: string;
  riderId: string | null;
  riderName: string | null;
  addressText: string;
  pickupText: string | null;
  lat: number;
  lng: number;
  pickupLat: number | null;
  pickupLng: number | null;
  deliveryCharge: number;
  createdAt: string;
  updatedAt: string;
  lastMessage: string | null;
  lastMessageFrom: 'CUSTOMER' | 'RIDER' | 'ADMIN' | null;
};

/** One rider as the manager sees them when picking who gets an order. */
export type AssignableRider = {
  id: string;
  name: string;
  vehicleType: string | null;
  online: boolean;
  /** Straight-line km from the order's pickup (or from the area's centre on the riders page); null = the rider's position is not known. */
  distanceKm: number | null;
  /** Orders this rider is delivering right now. */
  activeOrders: number;
  unpaidOrders: number;
  rating: { average: number; count: number } | null;
  /** Why the rider cannot get a new order: unpaid commission, or Mangwaoo's block. null = may get one. */
  hold: 'PAYMENT' | 'ADMIN' | null;
  canAssign: boolean;
  /** One short line for the screen when `canAssign` is false. */
  reason: string | null;
};
