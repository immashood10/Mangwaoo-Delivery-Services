import { NextRequest, NextResponse } from 'next/server';
import { loadSellerOrders } from '@/lib/seller-analytics';
import { getCurrentSeller } from '@/lib/seller-context';
import { buildReport, parseReportRange, parseReportType } from '@/lib/seller-reports';

const DAY_MS = 24 * 60 * 60 * 1000;

// GET /api/seller/reports?type=orders|products|customers&range=30|90|365|all: the signed-in seller's own numbers as a CSV file.
export async function GET(request: NextRequest) {
  const seller = await getCurrentSeller();

  if (!seller) {
    return NextResponse.json({ error: 'Please log in as a seller to download reports.' }, { status: 401 });
  }

  const type = parseReportType(request.nextUrl.searchParams.get('type'));
  const range = parseReportRange(request.nextUrl.searchParams.get('range'));
  const since = range.days === null ? 0 : Date.now() - range.days * DAY_MS;
  const orders = (await loadSellerOrders(seller)).filter((order) => order.createdAt.getTime() >= since);

  return new NextResponse(buildReport(type, orders), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="mangwaoo-${type}-${range.key === 'all' ? 'all-time' : `last-${range.key}-days`}.csv"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
