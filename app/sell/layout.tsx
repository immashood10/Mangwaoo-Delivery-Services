import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sell on Mangwaoo',
  description: 'Sign up as a vendor to list your shop on MangwaooMart, or log in to your seller account.',
};

export default function SellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
