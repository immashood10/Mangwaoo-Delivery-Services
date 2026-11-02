import { Users } from 'lucide-react';
import type { AudienceMetric, MarketingAudienceSummary } from '@/lib/marketing-audience-config';

function Breakdown({ title, metrics }: { title: string; metrics: AudienceMetric[] }) {
  return (
    <section aria-label={title}>
      <h3 className="mb-3 text-sm font-bold text-ink">{title}</h3>
      <ul className="space-y-3">
        {metrics.map((metric) => (
          <li key={metric.key}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="text-brand-gray">{metric.label}</span>
              <span className="shrink-0 font-semibold text-ink">
                {metric.percent}% <span className="font-normal text-brand-gray">({metric.count.toLocaleString()})</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-brand-light">
              <div className="h-full rounded-full bg-brand-red-primary" style={{ width: `${metric.percent}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function AdminMarketingAudience({ summary }: { summary: MarketingAudienceSummary }) {
  return (
    <section aria-labelledby="marketing-audience-heading" className="mb-8 rounded-2xl bg-surface p-5 shadow-soft sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="marketing-audience-heading" className="flex items-center gap-2 text-lg font-bold text-ink">
            <Users className="h-5 w-5 text-accent" />
            Customer audience
          </h2>
          <p className="mt-1 text-xs text-brand-gray">
            Aggregate profile data only. Percentages are out of {summary.totalCustomers.toLocaleString()} active,
            verified customer accounts.
          </p>
        </div>
        <p className="rounded-xl bg-brand-light px-3 py-2 text-sm font-semibold text-ink">
          Adult profiles: {summary.adultProfiles.toLocaleString()}
        </p>
      </div>

      {summary.totalCustomers === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-brand-gray">
          No eligible customer profiles to report yet.
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <Breakdown title="Age" metrics={summary.ageGroups} />
          <Breakdown title="Gender" metrics={summary.genders} />
        </div>
      )}

      <p className="mt-5 border-t border-gray-100 pt-4 text-xs text-brand-gray">
        Only voluntarily provided 18+ profile data is used for paid-ad matching. Under-18 customers are not profiled or
        targeted; customers without matching details won&apos;t see age- or gender-targeted ads.
      </p>
    </section>
  );
}
