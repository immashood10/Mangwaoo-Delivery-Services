'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AUDIENCE_AGE_BANDS, AUDIENCE_GENDERS, estimateAudienceReach } from '@/lib/marketing-audience-config';
import type { AudienceAgeKey, AudienceGender, MarketingAudienceSummary } from '@/lib/marketing-audience-config';
import type { AdRequestRow } from '@/lib/promotions';

type Props = {
  ad: AdRequestRow;
  summary: MarketingAudienceSummary;
};

function ageKeyForAd(ad: AdRequestRow): 'ALL' | AudienceAgeKey {
  if (ad.targetAgeMin === null && ad.targetAgeMax === null) return 'ALL';
  return (
    AUDIENCE_AGE_BANDS.find((band) => band.min === ad.targetAgeMin && band.max === ad.targetAgeMax)?.key ?? 'ALL'
  );
}

export default function AdAudienceSettings({ ad, summary }: Props) {
  const router = useRouter();
  const [ageKey, setAgeKey] = useState<'ALL' | AudienceAgeKey>(() => ageKeyForAd(ad));
  const [gender, setGender] = useState<'ALL' | AudienceGender>(ad.targetGender ?? 'ALL');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const ageBand = AUDIENCE_AGE_BANDS.find((band) => band.key === ageKey);
  const targetAgeMin = ageKey === 'ALL' ? null : ageBand?.min ?? null;
  const targetAgeMax = ageKey === 'ALL' ? null : ageBand?.max ?? null;
  const targetGender = gender === 'ALL' ? null : gender;
  const reach = estimateAudienceReach(summary, ageKey, gender);

  const save = async () => {
    setBusy(true);
    setError('');
    setSaved(false);

    try {
      const response = await fetch(`/api/admin/ads/${ad.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'audience', targetAgeMin, targetAgeMax, targetGender }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? 'Could not save this audience. Please try again.');
        return;
      }

      setSaved(true);
      router.refresh();
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-brand-light/50 p-4">
      <h3 className="text-sm font-bold text-ink">Paid-ad audience</h3>
      <p className="mt-1 text-xs text-brand-gray">
        This only controls where the paid placement appears. The product remains available in the regular catalog.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-ink">
          Age
          <select
            value={ageKey}
            onChange={(event) => {
              setAgeKey(event.target.value as 'ALL' | AudienceAgeKey);
              setSaved(false);
            }}
            className="mt-1 block w-full rounded-lg border border-gray-300 bg-surface px-3 py-2 text-sm font-normal text-ink"
          >
            <option value="ALL">All ages (no age filter)</option>
            {AUDIENCE_AGE_BANDS.map((band) => (
              <option key={band.key} value={band.key}>
                {band.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-ink">
          Gender
          <select
            value={gender}
            onChange={(event) => {
              setGender(event.target.value as 'ALL' | AudienceGender);
              setSaved(false);
            }}
            className="mt-1 block w-full rounded-lg border border-gray-300 bg-surface px-3 py-2 text-sm font-normal text-ink"
          >
            <option value="ALL">All genders (no filter)</option>
            {AUDIENCE_GENDERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-3 text-xs text-brand-gray">
        {reach ? (
          <>
            Estimated matching profiles: <strong className="text-ink">{reach.count.toLocaleString()}</strong> (
            {reach.percent}% of eligible accounts). Customers without the selected details won&apos;t match.
          </>
        ) : (
          'No audience filters selected; the ad can appear to everyone.'
        )}
      </p>
      {error ? <p role="alert" className="mt-2 text-xs text-danger">{error}</p> : null}
      {saved ? <p role="status" className="mt-2 text-xs font-semibold text-success">Audience saved.</p> : null}
      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className="mt-3 rounded-lg bg-brand-red-primary px-4 py-2 text-xs font-semibold text-white hover:bg-brand-red-secondary disabled:opacity-60"
      >
        {busy ? 'Saving…' : 'Save audience'}
      </button>
    </div>
  );
}
