'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

// Chart chrome and the three categorical series come from CSS variables (app/globals.css),
// so they switch with the device theme: the light values are the validated reference palette
// on white, the dark values are the same hues re-stepped for the dark surface. Aqua is < 3:1
// on white, so every chart still ships a legend, direct labels and a table view.
export const INK = {
  primary: 'var(--chart-ink)',
  secondary: 'var(--chart-ink-secondary)',
  muted: 'var(--chart-ink-muted)',
  grid: 'var(--chart-grid)',
  baseline: 'var(--chart-baseline)',
  surface: 'var(--chart-surface)',
  hover: 'var(--chart-hover)',
};

const BASE_MARGIN = { top: 22, right: 12, bottom: 28, left: 36 };

/** Leaves room on the left for the widest y-axis label (e.g. "15,000"). */
function marginFor(ticks: number[]) {
  const longest = Math.max(...ticks.map((tick) => formatNumber(tick).length));
  return { ...BASE_MARGIN, left: Math.max(BASE_MARGIN.left, Math.ceil(longest * 6.6) + 14) };
}
const PLOT_HEIGHT = 200;
const SEGMENT_GAP = 2;
const MAX_BAR_WIDTH = 24;

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

function niceTicks(max: number, targetCount = 4) {
  if (max <= 0) return [0, 1];
  const raw = max / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? magnitude * 10);
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

/** Bar with a 4px rounded data-end and a square baseline. */
function roundedTopPath(x: number, y: number, width: number, height: number, radius = 4) {
  if (height <= 0 || width <= 0) return '';
  const r = Math.min(radius, width / 2, height);
  return `M${x},${y + height} V${y + r} A${r},${r} 0 0 1 ${x + r},${y} H${x + width - r} A${r},${r} 0 0 1 ${x + width},${y + r} V${y + height} Z`;
}

export function formatNumber(value: number) {
  return value.toLocaleString('en-PK');
}

export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  children,
}: {
  title: string;
  subtitle: ReactNode;
  legend?: ReactNode;
  table: ReactNode;
  children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);

  return (
    <section className="rounded-2xl bg-surface p-5 shadow-soft">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-ink">{title}</h3>
          <p className="text-sm text-brand-gray">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowTable((prev) => !prev)}
          className="shrink-0 rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-ink hover:border-accent hover:text-accent"
          aria-pressed={showTable}
        >
          {showTable ? 'Chart' : 'Table'}
        </button>
      </div>
      {legend && !showTable ? <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">{legend}</div> : null}
      {showTable ? <div className="max-h-[260px] overflow-auto">{table}</div> : children}
    </section>
  );
}

export function LegendItem({ color, label, shape = 'rect' }: { color: string; label: string; shape?: 'rect' | 'line' }) {
  return (
    <span className="flex items-center gap-1.5 text-xs" style={{ color: INK.secondary }}>
      {shape === 'rect' ? (
        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      ) : (
        <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: color }} />
      )}
      {label}
    </span>
  );
}

function Tooltip({
  x,
  containerWidth,
  title,
  rows,
}: {
  x: number;
  containerWidth: number;
  title: string;
  rows: { label: string; value: string; color?: string; strong?: boolean }[];
}) {
  const halfWidth = 85;
  const left = Math.min(Math.max(x, halfWidth), Math.max(halfWidth, containerWidth - halfWidth));

  return (
    <div
      role="status"
      className="pointer-events-none absolute top-0 z-10 w-[170px] -translate-x-1/2 rounded-lg bg-surface px-3 py-2 text-xs shadow-lg ring-1 ring-black/10"
      style={{ left }}
    >
      <p className="mb-1 font-semibold" style={{ color: INK.secondary }}>
        {title}
      </p>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5" style={{ color: INK.secondary }}>
            {row.color ? <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: row.color }} /> : null}
            {row.label}
          </span>
          <span className={row.strong ? 'font-bold' : 'font-semibold'} style={{ color: INK.primary }}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export type ColumnSeries = { key: string; label: string; color: string; values: number[] };

export function ColumnChart({
  categories,
  tooltipTitles,
  series,
  ariaLabel,
}: {
  categories: string[];
  tooltipTitles: string[];
  series: ColumnSeries[];
  ariaLabel: string;
}) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const totals = categories.map((_, i) => series.reduce((sum, s) => sum + s.values[i], 0));
  const maxTotal = Math.max(0, ...totals);
  const ticks = niceTicks(maxTotal);
  const MARGIN = marginFor(ticks);
  const yMax = ticks[ticks.length - 1];
  const peakIndex = maxTotal > 0 ? totals.indexOf(maxTotal) : -1;

  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const band = categories.length > 0 ? plotWidth / categories.length : 0;
  const barWidth = Math.min(MAX_BAR_WIDTH, band * 0.62);
  const labelEvery = Math.max(1, Math.ceil(categories.length / Math.max(1, Math.floor(plotWidth / 52))));
  const y = (value: number) => MARGIN.top + PLOT_HEIGHT - (value / yMax) * PLOT_HEIGHT;
  const svgHeight = MARGIN.top + PLOT_HEIGHT + MARGIN.bottom;

  return (
    <div ref={ref} className="relative" style={{ height: svgHeight }}>
      {width > 0 && (
        <svg width={width} height={svgHeight} role="img" aria-label={ariaLabel}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke={tick === 0 ? INK.baseline : INK.grid}
                strokeWidth={1}
              />
              <text x={MARGIN.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={11} fill={INK.muted} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatNumber(tick)}
              </text>
            </g>
          ))}

          {categories.map((category, i) => {
            const bandX = MARGIN.left + i * band;
            const barX = bandX + (band - barWidth) / 2;
            let cumulative = 0;
            const visible = series.filter((s) => s.values[i] > 0);

            return (
              <g key={category}>
                {activeIndex === i && (
                  <rect x={bandX} y={MARGIN.top} width={band} height={PLOT_HEIGHT} fill={INK.hover} rx={4} />
                )}
                {visible.map((s, segmentIndex) => {
                  const start = cumulative;
                  cumulative += s.values[i];
                  const top = y(cumulative);
                  const bottom = y(start) - (segmentIndex > 0 ? SEGMENT_GAP : 0);
                  const height = bottom - top;
                  const isTop = segmentIndex === visible.length - 1;

                  return isTop ? (
                    <path key={s.key} d={roundedTopPath(barX, top, barWidth, height)} fill={s.color} />
                  ) : (
                    <rect key={s.key} x={barX} y={top} width={barWidth} height={Math.max(0, height)} fill={s.color} />
                  );
                })}
                {i === peakIndex && (
                  <text x={bandX + band / 2} y={y(totals[i]) - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill={INK.primary}>
                    {formatNumber(totals[i])}
                  </text>
                )}
                {i % labelEvery === 0 && (
                  <text x={bandX + band / 2} y={MARGIN.top + PLOT_HEIGHT + 18} textAnchor="middle" fontSize={11} fill={INK.muted}>
                    {category}
                  </text>
                )}
                <rect
                  x={bandX}
                  y={MARGIN.top}
                  width={band}
                  height={PLOT_HEIGHT}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${tooltipTitles[i]}: ${totals[i]} total`}
                  onPointerEnter={() => setActiveIndex(i)}
                  onPointerMove={() => setActiveIndex(i)}
                  onPointerLeave={() => setActiveIndex(null)}
                  onFocus={() => setActiveIndex(i)}
                  onBlur={() => setActiveIndex(null)}
                  style={{ outline: 'none' }}
                />
              </g>
            );
          })}
        </svg>
      )}

      {maxTotal === 0 && width > 0 && (
        <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm" style={{ color: INK.muted }}>
          No data in this period yet
        </p>
      )}

      {activeIndex !== null && (
        <Tooltip
          x={MARGIN.left + (activeIndex + 0.5) * band}
          containerWidth={width}
          title={tooltipTitles[activeIndex]}
          rows={[
            ...(series.length > 1
              ? [{ label: 'Total', value: formatNumber(totals[activeIndex]), strong: true }]
              : []),
            ...series.map((s) => ({
              label: s.label,
              value: formatNumber(s.values[activeIndex]),
              color: s.color,
              strong: series.length === 1,
            })),
          ]}
        />
      )}
    </div>
  );
}

export function LineChart({
  categories,
  tooltipTitles,
  values,
  color,
  unit,
  ariaLabel,
  valueLabel = 'Value',
  emptyMessage = 'No data in this period yet',
}: {
  categories: string[];
  tooltipTitles: string[];
  values: (number | null)[];
  color: string;
  unit: string;
  ariaLabel: string;
  /** Row label in the hover tooltip. */
  valueLabel?: string;
  emptyMessage?: string;
}) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const present = values.filter((v): v is number => v !== null);
  const ticks = niceTicks(Math.max(0, ...present));
  const MARGIN = marginFor(ticks);
  const yMax = ticks[ticks.length - 1];

  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const step = categories.length > 1 ? plotWidth / (categories.length - 1) : 0;
  const x = (i: number) => MARGIN.left + (categories.length > 1 ? i * step : plotWidth / 2);
  const y = (value: number) => MARGIN.top + PLOT_HEIGHT - (value / yMax) * PLOT_HEIGHT;
  const labelEvery = Math.max(1, Math.ceil(categories.length / Math.max(1, Math.floor(plotWidth / 52))));
  const svgHeight = MARGIN.top + PLOT_HEIGHT + MARGIN.bottom;

  // Split the line at days with no data instead of drawing through them.
  const segments: string[] = [];
  let current = '';
  values.forEach((value, i) => {
    if (value === null) {
      if (current) segments.push(current);
      current = '';
      return;
    }
    current += `${current ? 'L' : 'M'}${x(i)},${y(value)}`;
  });
  if (current) segments.push(current);

  let lastIndex = -1;
  values.forEach((value, i) => {
    if (value !== null) lastIndex = i;
  });

  const isIsolated = (i: number) => values[i] !== null && values[i - 1] == null && values[i + 1] == null;

  // Put the end label on the side the line isn't coming from, so it never sits on the stroke.
  const lastValue = lastIndex >= 0 ? values[lastIndex] : null;
  const previousValue = lastIndex > 0 ? values[lastIndex - 1] : null;
  const endLabelBelow = lastValue !== null && previousValue !== null && previousValue > lastValue;

  const indexFromPointer = (clientX: number, target: Element) => {
    const rect = target.getBoundingClientRect();
    const relative = clientX - rect.left - MARGIN.left;
    return Math.min(categories.length - 1, Math.max(0, Math.round(step > 0 ? relative / step : 0)));
  };

  const handleKeyDown = (event: KeyboardEvent<SVGRectElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      setActiveIndex((prev) => Math.min(categories.length - 1, Math.max(0, (prev ?? lastIndex) + delta)));
    }
  };

  return (
    <div ref={ref} className="relative" style={{ height: svgHeight }}>
      {width > 0 && (
        <svg width={width} height={svgHeight} role="img" aria-label={ariaLabel}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke={tick === 0 ? INK.baseline : INK.grid}
                strokeWidth={1}
              />
              <text x={MARGIN.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={11} fill={INK.muted} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatNumber(tick)}
              </text>
            </g>
          ))}

          {categories.map((category, i) =>
            i % labelEvery === 0 ? (
              <text key={category} x={x(i)} y={MARGIN.top + PLOT_HEIGHT + 18} textAnchor="middle" fontSize={11} fill={INK.muted}>
                {category}
              </text>
            ) : null
          )}

          {activeIndex !== null && (
            <line x1={x(activeIndex)} x2={x(activeIndex)} y1={MARGIN.top} y2={MARGIN.top + PLOT_HEIGHT} stroke={INK.baseline} strokeWidth={1} />
          )}

          {segments.map((d) => (
            <path key={d} d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}

          {values.map((value, i) =>
            value !== null && (isIsolated(i) || i === lastIndex || i === activeIndex) ? (
              <circle key={i} cx={x(i)} cy={y(value)} r={4.5} fill={color} stroke={INK.surface} strokeWidth={2} />
            ) : null
          )}

          {lastValue !== null && activeIndex === null && (
            <text
              x={x(lastIndex) - 6}
              y={y(lastValue) + (endLabelBelow ? 20 : -12)}
              textAnchor="end"
              fontSize={11}
              fontWeight={600}
              fill={INK.primary}
            >
              {`${lastValue} ${unit}`}
            </text>
          )}

          <rect
            x={MARGIN.left - step / 2}
            y={MARGIN.top}
            width={plotWidth + step}
            height={PLOT_HEIGHT}
            fill="transparent"
            tabIndex={0}
            aria-label={`${ariaLabel}. Use left and right arrow keys to read each day.`}
            onPointerEnter={(event) => setActiveIndex(indexFromPointer(event.clientX, event.currentTarget.ownerSVGElement ?? event.currentTarget))}
            onPointerMove={(event) => setActiveIndex(indexFromPointer(event.clientX, event.currentTarget.ownerSVGElement ?? event.currentTarget))}
            onPointerLeave={() => setActiveIndex(null)}
            onFocus={() => setActiveIndex(lastIndex >= 0 ? lastIndex : 0)}
            onBlur={() => setActiveIndex(null)}
            onKeyDown={handleKeyDown}
            style={{ outline: 'none' }}
          />
        </svg>
      )}

      {present.length === 0 && width > 0 && (
        <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm" style={{ color: INK.muted }}>
          {emptyMessage}
        </p>
      )}

      {activeIndex !== null && (
        <Tooltip
          x={x(activeIndex)}
          containerWidth={width}
          title={tooltipTitles[activeIndex]}
          rows={[
            {
              label: valueLabel,
              value: values[activeIndex] !== null ? `${values[activeIndex]} ${unit}` : '—',
              strong: true,
            },
          ]}
        />
      )}
    </div>
  );
}

export function DataTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-surface">
        <tr className="border-b border-gray-100 text-left" style={{ color: INK.secondary }}>
          {headers.map((header, i) => (
            <th key={header} className={`py-2 pr-3 font-semibold ${i > 0 ? 'text-right' : ''}`}>
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody style={{ fontVariantNumeric: 'tabular-nums' }}>
        {rows.map((row) => (
          <tr key={String(row[0])} className="border-b border-gray-50 last:border-0">
            {row.map((cell, i) => (
              <td key={i} className={`py-1.5 pr-3 ${i > 0 ? 'text-right' : ''}`} style={{ color: i === 0 ? INK.secondary : INK.primary }}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function BarList({
  rows,
  color,
  ariaLabel,
  emptyMessage,
}: {
  rows: { label: string; value: number; detail?: string }[];
  color: string;
  ariaLabel: string;
  emptyMessage: string;
}) {
  const max = Math.max(0, ...rows.map((row) => row.value));

  if (rows.length === 0 || max === 0) {
    return (
      <p className="py-10 text-center text-sm" style={{ color: INK.muted }}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <ol aria-label={ariaLabel} className="space-y-3">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium" style={{ color: INK.primary }} title={row.label}>
              {row.label}
            </span>
            <span className="shrink-0 font-semibold" style={{ color: INK.primary, fontVariantNumeric: 'tabular-nums' }}>
              {formatNumber(row.value)}
              {row.detail ? (
                <span className="ml-2 text-xs font-normal" style={{ color: INK.secondary }}>
                  {row.detail}
                </span>
              ) : null}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full" style={{ background: INK.grid }}>
            <div className="h-full rounded-full" style={{ width: `${Math.max(2, (row.value / max) * 100)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
