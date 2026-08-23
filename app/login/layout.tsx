import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login - Mangwaoo',
  description: 'Log in to your Mangwaoo account to track orders and manage your delivery preferences.',
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
