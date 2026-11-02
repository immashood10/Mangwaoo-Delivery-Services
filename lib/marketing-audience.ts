import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ageOnKarachiDate, buildMarketingAudienceSummary, type MarketingAudience, type MarketingAudienceSummary } from '@/lib/marketing-audience-config';

export {
  ageOnKarachiDate,
  latestAdultBirthDate,
  matchesMarketingAudience,
  AUDIENCE_AGE_BANDS,
  AUDIENCE_GENDERS,
  estimateAudienceReach,
} from '@/lib/marketing-audience-config';
export type {
  AudienceAgeKey,
  AudienceGender,
  AudienceMetric,
  MarketingAudience,
  MarketingAudienceSummary,
  MarketingTarget,
} from '@/lib/marketing-audience-config';

/** Request-specific profile data used only to decide whether a paid ad may be shown. */
export async function getCurrentMarketingAudience(): Promise<MarketingAudience | null> {
  const session = await getSession();
  if (!session || session.role !== 'CUSTOMER') return null;

  const profile = await prisma.customer.findUnique({
    where: { userId: session.userId },
    select: { dateOfBirth: true, gender: true },
  });
  const age = profile?.dateOfBirth ? ageOnKarachiDate(profile.dateOfBirth) : null;

  if (age === null || age < 18 || age > 120) return { age: null, gender: null };

  return {
    age,
    gender:
      profile?.gender === 'MAN' || profile?.gender === 'WOMAN' || profile?.gender === 'NON_BINARY'
        ? profile.gender
        : null,
  };
}

type AudienceCellRow = { ageBand: string; gender: string; count: number };

/** Aggregate adult profile statistics only; raw customer data never leaves this query. */
export async function getMarketingAudienceSummary(): Promise<MarketingAudienceSummary> {
  const rows = await prisma.$queryRaw<AudienceCellRow[]>`
    WITH eligible AS (
      SELECT
        CASE
          WHEN age_years BETWEEN 18 AND 24 THEN '18-24'
          WHEN age_years BETWEEN 25 AND 34 THEN '25-34'
          WHEN age_years BETWEEN 35 AND 44 THEN '35-44'
          WHEN age_years BETWEEN 45 AND 54 THEN '45-54'
          WHEN age_years BETWEEN 55 AND 120 THEN '55+'
          ELSE 'NOT_SHARED'
        END AS age_band,
        CASE
          WHEN age_years BETWEEN 18 AND 120 THEN COALESCE(gender::text, 'NOT_SHARED')
          ELSE 'NOT_SHARED'
        END AS gender_group
      FROM (
        SELECT
          c."dateOfBirth",
          c.gender,
          CASE
            WHEN c."dateOfBirth" IS NULL THEN NULL
            ELSE date_part('year', age((now() AT TIME ZONE 'Asia/Karachi')::date, c."dateOfBirth"))::int
          END AS age_years
        FROM "Customer" c
        JOIN "User" u ON u.id = c."userId"
        WHERE u.role = 'CUSTOMER'::"Role"
          AND u."deletedAt" IS NULL
          AND u."isActive" = true
          AND u."phoneVerifiedAt" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM "UserBan" b
            WHERE b."userId" = u.id
              AND b."liftedAt" IS NULL
              AND (b.permanent = true OR b."endsAt" IS NULL OR b."endsAt" > now())
          )
      ) profiles
    )
    SELECT age_band AS "ageBand", gender_group AS gender, count(*)::int AS count
    FROM eligible
    GROUP BY age_band, gender_group`;

  return buildMarketingAudienceSummary(rows);
}
