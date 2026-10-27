// Two small charts for the super admin's overview, drawn as plain SVG on the server (no chart library, nothing to load in
// the browser). Colours are the site's theme variables, so they follow light and dark mode.

const WIDTH = 640;
const HEIGHT = 250;
const PAD = { left: 56, right: 16, top: 12, bottom: 28 };

/** 0, 50K, 1.2L ... (lakh style, as Pakistanis read money) */
export function shortMoney(value: number) {
  if (value >= 10_000_000) return `${+(value / 10_000_000).toFixed(1)}Cr`;
  if (value >= 100_000) return `${+(value / 100_000).toFixed(1)}L`;
  if (value >= 1000) return `${+(value / 1000).toFixed(1)}K`;
  return String(Math.round(value));
}

export function niceMax(value: number) {
  if (value <= 0) return 100;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value / 4) ?? 10;
  return Math.ceil(value / (step * magnitude)) * step * magnitude;
}

export function SalesAreaChart({ days }: { days: { label: string; sales: number }[] }) {
  const max = niceMax(Math.max(...days.map((day) => day.sales), 0));
  const innerWidth = WIDTH - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (index: number) => PAD.left + (days.length === 1 ? innerWidth / 2 : (index / (days.length - 1)) * innerWidth);
  const y = (value: number) => PAD.top + innerHeight - (value / max) * innerHeight;
  const line = days.map((day, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(day.sales).toFixed(1)}`).join(' ');
  const area = `${line} L${x(days.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const ticks = [0, 1, 2, 3, 4].map((step) => (max / 4) * step);
  const labelEvery = Math.ceil(days.length / 7);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label="Sales per day">
      <defs>
        <linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {ticks.map((tick) => (
        <g key={tick} className="text-brand-gray">
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(tick)} y2={y(tick)} stroke="currentColor" strokeOpacity="0.2" />
          <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end" fontSize="11" fill="currentColor">
            {shortMoney(tick)}
          </text>
        </g>
      ))}

      <path d={area} fill="url(#sales-fill)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {days.map((day, index) => (
        <g key={day.label} className="text-brand-gray">
          <circle cx={x(index)} cy={y(day.sales)} r="3.5" fill="var(--accent)">
            <title>{`${day.label}: PKR ${Math.round(day.sales).toLocaleString('en-IN')}`}</title>
          </circle>
          {index % labelEvery === 0 || index === days.length - 1 ? (
            <text x={x(index)} y={HEIGHT - 8} textAnchor="middle" fontSize="11" fill="currentColor">
              {day.label}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}

export type DonutSegment = { label: string; value: number; color: string };

export function VendorDonut({ segments }: { segments: DonutSegment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg viewBox="0 0 180 180" className="h-44 w-44 shrink-0" role="img" aria-label={`${total} vendors`}>
      <circle cx="90" cy="90" r={radius} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="22" className="text-brand-gray" />
      {total > 0
        ? segments
            .filter((segment) => segment.value > 0)
            .map((segment) => {
              const length = (segment.value / total) * circumference;
              const circle = (
                <circle
                  key={segment.label}
                  cx="90"
                  cy="90"
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="22"
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 90 90)"
                />
              );
              offset += length;
              return circle;
            })
        : null}
      <text x="90" y="90" textAnchor="middle" fontSize="26" fontWeight="700" fill="var(--ink)">
        {total}
      </text>
      <text x="90" y="110" textAnchor="middle" fontSize="11" fill="currentColor" className="text-brand-gray">
        Total Vendors
      </text>
    </svg>
  );
}
