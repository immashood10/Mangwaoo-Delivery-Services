import { PAYMENT_LABELS, statusLabel, summarizeCustomers, summarizeSales, type AnalyticsOrder } from '@/lib/seller-analytics';

// The seller's downloadable reports (CSV, opens in Excel or Google Sheets).

export const REPORT_TYPES = ['orders', 'products', 'customers'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_RANGES = [
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: '90', label: 'Last 90 days', days: 90 },
  { key: '365', label: 'Last 12 months', days: 365 },
  { key: 'all', label: 'Everything', days: null },
] as const;

export function parseReportRange(value: string | null | undefined) {
  return REPORT_RANGES.find((range) => range.key === value) ?? REPORT_RANGES[0];
}

export function parseReportType(value: string | null | undefined): ReportType {
  return (REPORT_TYPES as readonly string[]).includes(value ?? '') ? (value as ReportType) : 'orders';
}

/** One CSV cell. A name that starts with = + - @ would run as a formula in a spreadsheet, so it gets a ' in front. */
function cell(value: string | number | null | undefined) {
  let text = value === null || value === undefined ? '' : String(value);

  if (/^[=+\-@\t\r]/.test(text) && typeof value === 'string') text = `'${text}`;

  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const row = (values: (string | number | null | undefined)[]) => values.map(cell).join(',');
const day = (date: Date) => date.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });

export function buildReport(type: ReportType, orders: AnalyticsOrder[]) {
  const lines: string[] = [];

  if (type === 'orders') {
    lines.push(row(['Order ID', 'Date', 'Status', 'Customer', 'Products', 'Payment', 'Amount (PKR)']));

    for (const order of orders) {
      lines.push(
        row([
          order.ref,
          day(order.createdAt),
          statusLabel(order.status),
          order.customerName,
          order.items.map((item) => `${item.name} x${item.quantity}`).join('; '),
          PAYMENT_LABELS[order.payment ?? ''] ?? '',
          Math.round(order.revenue),
        ])
      );
    }
  } else if (type === 'products') {
    lines.push(row(['Product', 'Category', 'Units sold', 'Share of revenue (%)', 'Earnings (PKR)']));

    for (const product of summarizeSales(orders).products) {
      lines.push(row([product.name, product.category, product.units, Math.round(product.percent * 10) / 10, Math.round(product.revenue)]));
    }
  } else {
    lines.push(row(['Customer', 'Orders', 'Delivered orders', 'Spent (PKR)', 'Last order']));

    for (const customer of summarizeCustomers(orders)) {
      lines.push(row([customer.name, customer.orders, customer.delivered, Math.round(customer.spent), day(customer.lastOrder)]));
    }
  }

  // The leading BOM lets Excel read Urdu or accented names correctly.
  return `﻿${lines.join('\r\n')}\r\n`;
}
