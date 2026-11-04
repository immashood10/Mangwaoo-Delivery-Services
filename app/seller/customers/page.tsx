import { redirect } from 'next/navigation';

// Customer details are not shown to vendors: Mangwaoo's team handles the customers and the delivery.
export default function SellerCustomersPage() {
  redirect('/seller/dashboard');
}
