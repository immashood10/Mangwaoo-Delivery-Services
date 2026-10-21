import { prisma } from '@/lib/prisma';

export const KARACHI_UTC_OFFSET_MS = 5 * 60 * 60 * 1000; // PKT is UTC+5, no DST
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export const CHART_RANGES = [7, 14, 30] as const;
export type ChartRange = (typeof CHART_RANGES)[number];
export const DEFAULT_CHART_RANGE: ChartRange = 14;

export type DailyStat = {
  date: string; // YYYY-MM-DD, Karachi time
  label: string; // e.g. "13 Oct"
  martOrders: number;
  foodOrders: number;
  chatOrders: number;
  /** Average minutes from a chat opening until a rider replies; null when no chat was picked up that day. */
  avgRiderResponseMin: number | null;
};

export type AdminChartData = {
  rangeDays: ChartRange;
  days: DailyStat[];
  /** Orders + order chats by hour of day (0–23, Karachi time) across the range. */
  hourly: number[];
};

export function parseChartRange(value: string | undefined): ChartRange {
  const parsed = Number(value);
  return (CHART_RANGES as readonly number[]).includes(parsed) ? (parsed as ChartRange) : DEFAULT_CHART_RANGE;
}

export function startOfKarachiDay(timestamp: number) {
  return Math.floor((timestamp + KARACHI_UTC_OFFSET_MS) / DAY_MS) * DAY_MS - KARACHI_UTC_OFFSET_MS;
}

function karachiDayKey(date: Date) {
  return new Date(date.getTime() + KARACHI_UTC_OFFSET_MS).toISOString().slice(0, 10);
}

function karachiHour(date: Date) {
  return Math.floor(((date.getTime() + KARACHI_UTC_OFFSET_MS) % DAY_MS) / HOUR_MS);
}

export async function getAdminChartData(rangeDays: ChartRange): Promise<AdminChartData> {
  const todayStart = startOfKarachiDay(Date.now());
  const rangeStart = new Date(todayStart - (rangeDays - 1) * DAY_MS);

  const [martOrders, foodOrders, chats] = await Promise.all([
    prisma.order.findMany({ where: { createdAt: { gte: rangeStart } }, select: { createdAt: true } }),
    prisma.gulplazaOrder.findMany({ where: { createdAt: { gte: rangeStart } }, select: { createdAt: true } }),
    prisma.riderChat.findMany({
      where: { createdAt: { gte: rangeStart } },
      select: { createdAt: true, claimedAt: true },
    }),
  ]);

  const days: DailyStat[] = [];
  const byKey = new Map<string, DailyStat & { responseTotalMin: number; responseCount: number }>();

  for (let i = rangeDays - 1; i >= 0; i--) {
    const dayStart = new Date(todayStart - i * DAY_MS);
    const key = karachiDayKey(dayStart);
    const entry = {
      date: key,
      label: new Date(`${key}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
      martOrders: 0,
      foodOrders: 0,
      chatOrders: 0,
      avgRiderResponseMin: null,
      responseTotalMin: 0,
      responseCount: 0,
    };
    byKey.set(key, entry);
  }

  const hourly = Array.from({ length: 24 }, () => 0);

  for (const order of martOrders) {
    const day = byKey.get(karachiDayKey(order.createdAt));
    if (day) day.martOrders += 1;
    hourly[karachiHour(order.createdAt)] += 1;
  }

  for (const order of foodOrders) {
    const day = byKey.get(karachiDayKey(order.createdAt));
    if (day) day.foodOrders += 1;
    hourly[karachiHour(order.createdAt)] += 1;
  }

  for (const chat of chats) {
    const day = byKey.get(karachiDayKey(chat.createdAt));
    if (day) {
      day.chatOrders += 1;
      if (chat.claimedAt) {
        day.responseTotalMin += (chat.claimedAt.getTime() - chat.createdAt.getTime()) / 60000;
        day.responseCount += 1;
      }
    }
    hourly[karachiHour(chat.createdAt)] += 1;
  }

  for (const { responseTotalMin, responseCount, ...day } of byKey.values()) {
    days.push({
      ...day,
      avgRiderResponseMin: responseCount > 0 ? Math.round((responseTotalMin / responseCount) * 10) / 10 : null,
    });
  }

  return { rangeDays, days, hourly };
}
