import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Our Services - Mangwaoo.com',
  description: 'Fast food, grocery, dairy, and medicine delivery services in Karachi.',
};

export default function ServicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
