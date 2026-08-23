import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Food - Restaurants, Bakeries & Home Kitchens',
  description: 'Order from approved restaurants, bakeries, and home kitchens on Mangwaoo Food, with fast delivery across Karachi.',
};

export default function GulplazaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
