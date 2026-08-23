import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Service Areas - Mangwaoo.com',
  description: 'Check if Mangwaoo delivers to your area in Karachi.',
};

export default function AreasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
