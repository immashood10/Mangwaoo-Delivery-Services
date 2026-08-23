import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MangwaooMart - Groceries & Everyday Essentials',
  description: 'Shop groceries, dairy, household essentials, and more from local vendors on MangwaooMart, with fast delivery across Karachi.',
};

export default function MartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
