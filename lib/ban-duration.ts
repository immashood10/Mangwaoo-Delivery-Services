// How long a ban lasts and what the banned person is told. Pure functions with no database access, so the admin's
// ban form (in the browser) and the ban API (on the server) agree on the end date and the wording.

export const BAN_UNITS = ['hour', 'day', 'week', 'month', 'year'] as const;
export type BanUnit = (typeof BAN_UNITS)[number];

const UNIT_NAMES: Record<BanUnit, { one: string; many: string }> = {
  hour: { one: 'hour', many: 'hours' },
  day: { one: 'day', many: 'days' },
  week: { one: 'week', many: 'weeks' },
  month: { one: 'month', many: 'months' },
  year: { one: 'year', many: 'years' },
};

export const MAX_BAN_AMOUNT = 999;
export const MAX_BAN_YEARS = 100;
export const MAX_BAN_REASON_LENGTH = 200;

/** The quick choices on the ban form. They only fill in the duration fields, which the admin can change freely. */
export const BAN_PRESETS: { label: string; amount: number; unit: BanUnit }[] = [
  { label: '6 hours', amount: 6, unit: 'hour' },
  { label: '1 day', amount: 1, unit: 'day' },
  { label: '3 days', amount: 3, unit: 'day' },
  { label: '1 week', amount: 1, unit: 'week' },
  { label: '1 month', amount: 1, unit: 'month' },
  { label: '6 months', amount: 6, unit: 'month' },
  { label: '1 year', amount: 1, unit: 'year' },
];

export function unitName(unit: BanUnit, amount: number) {
  return amount === 1 ? UNIT_NAMES[unit].one : UNIT_NAMES[unit].many;
}

/** "7 days", "1 hour", "6 months". */
export function banLengthLabel(amount: number, unit: BanUnit) {
  return `${amount} ${unitName(unit, amount)}`;
}

/** `from` plus a number of hours / days / weeks / months / years (months and years follow the calendar, in UTC). */
export function addBanLength(from: Date, amount: number, unit: BanUnit) {
  const HOUR = 60 * 60 * 1000;

  if (unit === 'hour') return new Date(from.getTime() + amount * HOUR);
  if (unit === 'day') return new Date(from.getTime() + amount * 24 * HOUR);
  if (unit === 'week') return new Date(from.getTime() + amount * 7 * 24 * HOUR);

  const months = unit === 'year' ? amount * 12 : amount;
  const result = new Date(from.getTime());
  const day = result.getUTCDate();

  // Step to the 1st first so "31 Jan + 1 month" lands on the end of February, not in March.
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDayOfMonth = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDayOfMonth));

  return result;
}

export type BanInput =
  | { permanent: true; reason: string | null }
  | { permanent: false; amount: number; unit: BanUnit; endsAt: Date; durationLabel: string; reason: string | null };

/** Checks what the admin typed in the ban form (`now` is only a parameter so tests can fix it). */
export function parseBanInput(body: unknown, now = new Date()): { ok: true; input: BanInput } | { ok: false; error: string } {
  const record = (body ?? {}) as Record<string, unknown>;
  const reason = typeof record.reason === 'string' ? record.reason.trim().replace(/\s+/g, ' ') : '';

  if (reason.length > MAX_BAN_REASON_LENGTH) {
    return { ok: false, error: `The reason can be up to ${MAX_BAN_REASON_LENGTH} characters.` };
  }

  if (record.permanent === true) {
    return { ok: true, input: { permanent: true, reason: reason || null } };
  }

  const amount = Number(record.amount);
  const unit = BAN_UNITS.find((candidate) => candidate === record.unit);

  if (!unit) {
    return { ok: false, error: 'Choose hours, days, weeks, months or years.' };
  }

  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_BAN_AMOUNT) {
    return { ok: false, error: `Write how long as a whole number from 1 to ${MAX_BAN_AMOUNT}, or choose Permanent.` };
  }

  const endsAt = addBanLength(now, amount, unit);

  if (endsAt.getTime() > addBanLength(now, MAX_BAN_YEARS, 'year').getTime()) {
    return { ok: false, error: `That is more than ${MAX_BAN_YEARS} years. Choose Permanent instead.` };
  }

  return { ok: true, input: { permanent: false, amount, unit, endsAt, durationLabel: banLengthLabel(amount, unit), reason: reason || null } };
}

// Written out by hand instead of with Intl: the server and every browser then print exactly the same text,
// so a page rendered on the server never differs from what the browser draws over it.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const KARACHI_OFFSET_MS = 5 * 60 * 60 * 1000; // Pakistan time is UTC+5 all year

/** "28 Oct 2026" in Karachi time. */
export function formatKarachiDate(date: Date) {
  const local = new Date(date.getTime() + KARACHI_OFFSET_MS);

  return `${local.getUTCDate()} ${MONTHS[local.getUTCMonth()]} ${local.getUTCFullYear()}`;
}

/** "28 Oct 2026, 3:15 pm" in Karachi time. */
export function formatKarachiDateTime(date: Date) {
  const local = new Date(date.getTime() + KARACHI_OFFSET_MS);
  const hours = local.getUTCHours();
  const minutes = String(local.getUTCMinutes()).padStart(2, '0');

  return `${formatKarachiDate(date)}, ${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${hours < 12 ? 'am' : 'pm'}`;
}

export type BanSummary = {
  permanent: boolean;
  durationLabel: string;
  endsAt: Date | null;
  reason: string | null;
};

/** The sentence the banned person is shown: "You have been banned for 7 days from Mangwaoo". */
export function banHeadline(ban: Pick<BanSummary, 'permanent' | 'durationLabel'>) {
  return ban.permanent ? 'You have been banned permanently from Mangwaoo' : `You have been banned for ${ban.durationLabel} from Mangwaoo`;
}

/** What the notice says besides the headline: when the account works again, and the admin's reason. */
export function banDetails(ban: BanSummary) {
  return [
    !ban.permanent && ban.endsAt ? `You can log in again on ${formatKarachiDateTime(ban.endsAt)} (Karachi time).` : null,
    ban.reason ? `Reason: ${ban.reason}` : null,
  ].filter((line): line is string => line !== null);
}

/** The whole message in one string (for the login form, which shows a single line of text). */
export function banMessage(ban: BanSummary) {
  return [`${banHeadline(ban)}.`, ...banDetails(ban)].join(' ');
}

/** What the browser is told when a logged-in account is banned or deleted, so it can show the notice once. */
export type AccountNotice = {
  kind: 'BANNED' | 'DELETED';
  headline: string;
  details: string[];
  message: string;
};

export function banNotice(ban: BanSummary): AccountNotice {
  return { kind: 'BANNED', headline: banHeadline(ban), details: banDetails(ban), message: banMessage(ban) };
}

export const DELETED_NOTICE: AccountNotice = {
  kind: 'DELETED',
  headline: 'Your Mangwaoo account has been removed',
  details: ['You can no longer log in with it.'],
  message: 'Your Mangwaoo account has been removed. You can no longer log in with it.',
};
