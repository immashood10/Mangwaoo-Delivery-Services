import { RiderOrders } from '@/components/rider/RiderPages';

export const metadata = { title: 'New requests - Mangwaoo Rider' };

export default function RiderRequestsPage() {
  return <RiderOrders mode="requests" />;
}
