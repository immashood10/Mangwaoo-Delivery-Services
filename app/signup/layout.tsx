import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up - Mangwaoo',
  description: 'Create a Mangwaoo account to order food, groceries, dairy, and medicines with fast delivery.',
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
