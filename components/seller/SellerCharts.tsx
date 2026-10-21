'use client';

import type { SellerStats } from '@/lib/seller-stats';
import { BarList, ChartCard, ColumnChart, DataTable, formatNumber } from '@/components/charts/ChartKit';

// Series colors come from the chart CSS variables in app/globals.css (they follow the device theme).
const UNITS_COLOR = 'var(--chart-1)';
const REVENUE_COLOR = 'var(--chart-3)';

export default function SellerCharts({ stats }: { stats: SellerStats }) {
  const { days, topProducts, rangeDays } = stats;
  const dayLabels = days.map((day) => day.label);
  const dayTitles = days.map((day) =>
    new Date(`${day.date}T00:00:00Z`).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    })
  );

  const unitsInRange = days.reduce((sum, day) => sum + day.units, 0);
  const revenueInRange = days.reduce((sum, day) => sum + day.revenue, 0);

  return (
    <div className="space-y-6">
      <ChartCard
        title="Products sold per day"
        subtitle={
          unitsInRange > 0
            ? `${formatNumber(unitsInRange)} ${unitsInRange === 1 ? 'product' : 'products'} sold in the last ${rangeDays} days (counted when the order is delivered)`
            : `Nothing delivered in the last ${rangeDays} days yet`
        }
        table={
          <DataTable
            headers={['Day', 'Products sold', 'Orders']}
            rows={days.map((day, i) => [dayTitles[i], day.units, day.orders])}
          />
        }
      >
        <ColumnChart
          categories={dayLabels}
          tooltipTitles={dayTitles}
          ariaLabel={`Products sold per day for the last ${rangeDays} days`}
          series={[{ key: 'units', label: 'Products sold', color: UNITS_COLOR, values: days.map((day) => day.units) }]}
        />
      </ChartCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard
          title="Sales per day (PKR)"
          subtitle={
            revenueInRange > 0
              ? `PKR ${formatNumber(Math.round(revenueInRange))} from delivered orders in the last ${rangeDays} days`
              : 'Money from delivered orders, per day'
          }
          table={
            <DataTable
              headers={['Day', 'Sales (PKR)']}
              rows={days.map((day, i) => [dayTitles[i], formatNumber(Math.round(day.revenue))])}
            />
          }
        >
          <ColumnChart
            categories={dayLabels}
            tooltipTitles={dayTitles}
            ariaLabel={`Sales in rupees per day for the last ${rangeDays} days`}
            series={[{ key: 'revenue', label: 'Sales (PKR)', color: REVENUE_COLOR, values: days.map((day) => Math.round(day.revenue)) }]}
          />
        </ChartCard>

        <ChartCard
          title="Top selling products"
          subtitle="Products sold, all time (delivered orders)"
          table={
            <DataTable
              headers={['Product', 'Sold', 'Sales (PKR)']}
              rows={topProducts.map((product) => [product.name, product.units, formatNumber(Math.round(product.revenue))])}
            />
          }
        >
          <BarList
            ariaLabel="Top selling products by number sold"
            color={UNITS_COLOR}
            emptyMessage="No delivered orders yet. Your best sellers will show up here."
            rows={topProducts.map((product) => ({
              label: product.name,
              value: product.units,
              detail: `PKR ${formatNumber(Math.round(product.revenue))}`,
            }))}
          />
        </ChartCard>
      </div>
    </div>
  );
}
