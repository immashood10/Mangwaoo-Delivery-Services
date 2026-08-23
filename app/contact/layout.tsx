import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Mangwaoo - Get in Touch',
  description: 'Contact Mangwaoo for inquiries, feedback, or partnership opportunities.',
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
