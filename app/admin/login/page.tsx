import { redirect } from 'next/navigation';
import AdminLoginForm from '@/components/AdminLoginForm';
import { getSession } from '@/lib/auth';

export const metadata = {
  title: 'Admin log in - Mangwaoo',
  robots: { index: false, follow: false },
};

// The admin's own, plain log in page. It sits outside the admin layout (which sends anyone who isn't the admin here),
// and the website's navbar and footer are not shown on any /admin page.
export default async function AdminLoginPage() {
  const session = await getSession();

  if (session?.role === 'ADMIN') {
    redirect('/admin');
  }

  return <AdminLoginForm />;
}
