export type AudienceGender = 'MAN' | 'WOMAN' | 'NON_BINARY';
export type AudienceAgeKey = 'ADULTS' | '18-24' | '25-34' | '35-44' | '45-54' | '55+';

export const AUDIENCE_AGE_BANDS: { key: AudienceAgeKey; label: string; min: number; max: number | null }[] = [
  { key: 'ADULTS', label: 'All adults (18+)', min: 18, max: null },
  { key: '18-24', label: '18–24', min: 18, max: 24 },
  { key: '25-34', label: '25–34', min: 25, max: 34 },
  { key: '35-44', label: '35–44', min: 35, max: 44 },
  { key: '45-54', label: '45–54', min: 45, max: 54 },
  { key: '55+', label: '55+', min: 55, max: null },
];

export const AUDIENCE_GENDERS: { value: AudienceGender; label: string }[] = [
  { value: 'WOMAN', label: 'Women' },
  { value: 'MAN', label: 'Men' },
  { value: 'NON_BINARY', label: 'Non-binary' },
];

export type MarketingAudience = { age: number | null; gender: AudienceGender | null };
export type MarketingTarget = { targetAgeMin: number | null; targetAgeMax: number | null; targetGender: AudienceGender | null };
export type AudienceMetric = { key: string; label: string; count: number; percent: number };
export type MarketingAudienceSummary = {
  totalCustomers: number;
  adultProfiles: number;
  ageGroups: AudienceMetric[];
  genders: AudienceMetric[];
  ageGenderCounts: { ageBand: Exclude<AudienceAgeKey, 'ADULTS'>; gender: AudienceGender | 'NOT_SHARED'; count: number }[];
};

const AGE_BANDS = [
  { key: '18-24', label: '18–24' },
  { key: '25-34', label: '25–34' },
  { key: '35-44', label: '35–44' },
  { key: '45-54', label: '45–54' },
  { key: '55+', label: '55+' },
] as const;

const GENDER_GROUPS: { key: AudienceGender | 'NOT_SHARED'; label: string }[] = [
  { key: 'WOMAN', label: 'Women' },
  { key: 'MAN', label: 'Men' },
  { key: 'NON_BINARY', label: 'Non-binary' },
  { key: 'NOT_SHARED', label: 'Not shared / not eligible' },
];

function karachiToday(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);

  return { year: value('year'), month: value('month'), day: value('day') };
}

export function latestAdultBirthDate(now = new Date()) {
  const { year, month, day } = karachiToday(now);
  return `${String(year - 18).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function ageOnKarachiDate(dateOfBirth: Date, now = new Date()) {
  const today = karachiToday(now);
  const birthYear = dateOfBirth.getUTCFullYear();
  const birthMonth = dateOfBirth.getUTCMonth() + 1;
  const birthDay = dateOfBirth.getUTCDate();

  return today.year - birthYear - (today.month < birthMonth || (today.month === birthMonth && today.day < birthDay) ? 1 : 0);
}

export function matchesMarketingAudience(target: MarketingTarget, audience: MarketingAudience | null) {
  if (
    target.targetAgeMin !== null &&
    (audience?.age === null || audience?.age === undefined || audience.age < target.targetAgeMin)
  ) {
    return false;
  }
  if (
    target.targetAgeMax !== null &&
    (audience?.age === null || audience?.age === undefined || audience.age > target.targetAgeMax)
  ) {
    return false;
  }
  return target.targetGender === null || audience?.gender === target.targetGender;
}

function metric(key: string, label: string, count: number, total: number): AudienceMetric {
  return { key, label, count, percent: total > 0 ? Math.round((count / total) * 1000) / 10 : 0 };
}

export function buildMarketingAudienceSummary(rows: { ageBand: string; gender: string; count: number }[]): MarketingAudienceSummary {
  const cellCount = (ageBand: string, gender: string) =>
    rows.find((row) => row.ageBand === ageBand && row.gender === gender)?.count ?? 0;
  const totalCustomers = rows.reduce((sum, row) => sum + row.count, 0);
  const adultProfiles = AGE_BANDS.reduce(
    (sum, band) => sum + GENDER_GROUPS.reduce((n, group) => n + cellCount(band.key, group.key), 0),
    0
  );
  const ageGroups = [
    ...AGE_BANDS.map((band) =>
      metric(band.key, band.label, GENDER_GROUPS.reduce((sum, group) => sum + cellCount(band.key, group.key), 0), totalCustomers)
    ),
    metric('NOT_SHARED', 'Not shared / under 18 (not targeted)', cellCount('NOT_SHARED', 'NOT_SHARED'), totalCustomers),
  ];
  const genders = GENDER_GROUPS.map((group) =>
    metric(
      group.key,
      group.label,
      rows.reduce((sum, row) => sum + (row.gender === group.key ? row.count : 0), 0),
      totalCustomers
    )
  );
  const ageGenderCounts = AGE_BANDS.flatMap((band) =>
    GENDER_GROUPS.map((group) => ({ ageBand: band.key, gender: group.key, count: cellCount(band.key, group.key) }))
  );

  return { totalCustomers, adultProfiles, ageGroups, genders, ageGenderCounts };
}

export function estimateAudienceReach(
  summary: MarketingAudienceSummary,
  ageKey: 'ALL' | AudienceAgeKey,
  gender: 'ALL' | AudienceGender
) {
  if (ageKey === 'ALL' && gender === 'ALL') return null;

  const ageBands = ageKey === 'ALL' || ageKey === 'ADULTS' ? AGE_BANDS.map((band) => band.key) : [ageKey];
  const count = summary.ageGenderCounts.reduce(
    (sum, cell) =>
      sum +
      (ageBands.includes(cell.ageBand) && (gender === 'ALL' || cell.gender === gender) ? cell.count : 0),
    0
  );

  return {
    count,
    percent: summary.totalCustomers > 0 ? Math.round((count / summary.totalCustomers) * 1000) / 10 : 0,
  };
}
