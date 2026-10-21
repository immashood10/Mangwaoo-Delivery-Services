'use client';

import type { AdminChartData } from '@/lib/admin-stats';
import { ChartCard, ColumnChart, DataTable, LegendItem, LineChart, formatNumber } from '@/components/charts/ChartKit';

// Colors for the three series come from CSS variables (app/globals.css); see components/charts/ChartKit.tsx.
const SERIES = {
  mart: { label: 'Mart orders', color: 'var(--chart-1)' },
  food: { label: 'Food orders', color: 'var(--chart-2)' },
  chat: { label: 'Order chats', color: 'var(--chart-3)' },
};

function hourLabel(hour: number) {
  const suffix = hour < 12 ? 'am' : 'pm';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}${suffix}`;
}

export default function AdminCharts({ data }: { data: AdminChartData }) {
  const { days, hourly, rangeDays } = data;
  const dayLabels = days.map((day) => day.label);
  const dayTitles = days.map((day) =>
    new Date(`${day.date}T00:00:00Z`).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    })
  );

  const totalOrders = days.reduce((sum, d) => sum + d.martOrders + d.foodOrders + d.chatOrders, 0);
  const hourLabels = hourly.map((_, hour) => hourLabel(hour));
  const peakHour = hourly.some((count) => count > 0) ? hourly.indexOf(Math.max(...hourly)) : null;

  const responseDays = days.filter((d) => d.avgRiderResponseMin !== null);
  const overallResponse =
    responseDays.length > 0
      ? Math.round((responseDays.reduce((sum, d) => sum + (d.avgRiderResponseMin as number), 0) / responseDays.length) * 10) / 10
      : null;

  return (
    <div className="space-y-6">
      <ChartCard
        title="Orders per day"
        subtitle={`${formatNumber(totalOrders)} orders and order chats in the last ${rangeDays} days`}
        legend={
          <>
            <LegendItem color={SERIES.mart.color} label={SERIES.mart.label} />
            <LegendItem color={SERIES.food.color} label={SERIES.food.label} />
            <LegendItem color={SERIES.chat.color} label={SERIES.chat.label} />
          </>
        }
        table={
          <DataTable
            headers={['Day', 'Mart', 'Food', 'Chats', 'Total']}
            rows={days.map((d, i) => [
              dayTitles[i],
              d.martOrders,
              d.foodOrders,
              d.chatOrders,
              d.martOrders + d.foodOrders + d.chatOrders,
            ])}
          />
        }
      >
        <ColumnChart
          categories={dayLabels}
          tooltipTitles={dayTitles}
          ariaLabel={`Orders per day for the last ${rangeDays} days, stacked by Mart orders, Food orders and order chats`}
          series={[
            { key: 'mart', ...SERIES.mart, values: days.map((d) => d.martOrders) },
            { key: 'food', ...SERIES.food, values: days.map((d) => d.foodOrders) },
            { key: 'chat', ...SERIES.chat, values: days.map((d) => d.chatOrders) },
          ]}
        />
      </ChartCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard
          title="Busiest hours"
          subtitle={
            peakHour !== null
              ? `Peak at ${hourLabel(peakHour)}–${hourLabel((peakHour + 1) % 24)} (Karachi time)`
              : 'Orders and order chats by hour of day (Karachi time)'
          }
          table={
            <DataTable
              headers={['Hour', 'Orders + chats']}
              rows={hourly.map((count, hour) => [`${hourLabel(hour)}–${hourLabel((hour + 1) % 24)}`, count])}
            />
          }
        >
          <ColumnChart
            categories={hourLabels}
            tooltipTitles={hourly.map((_, hour) => `${hourLabel(hour)}–${hourLabel((hour + 1) % 24)}`)}
            ariaLabel={`Orders and order chats by hour of day over the last ${rangeDays} days`}
            series={[{ key: 'orders', label: 'Orders + chats', color: SERIES.mart.color, values: hourly }]}
          />
        </ChartCard>

        <ChartCard
          title="Rider reply time"
          subtitle={
            overallResponse !== null
              ? `Average ${overallResponse} min from order chat to first rider reply`
              : 'Minutes from order chat to first rider reply'
          }
          table={
            <DataTable
              headers={['Day', 'Avg reply (min)']}
              rows={days.map((d, i) => [dayTitles[i], d.avgRiderResponseMin ?? '—'])}
            />
          }
        >
          <LineChart
            categories={dayLabels}
            tooltipTitles={dayTitles}
            values={days.map((d) => d.avgRiderResponseMin)}
            color={SERIES.mart.color}
            unit="min"
            valueLabel="Avg reply time"
            emptyMessage="No chats picked up by riders in this period yet"
            ariaLabel={`Average rider reply time per day for the last ${rangeDays} days`}
          />
        </ChartCard>
      </div>
    </div>
  );
}
