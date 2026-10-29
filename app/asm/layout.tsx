import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { findManager } from '@/lib/area-managers';
import AsmShell from '@/components/asm/AsmShell';

export const metadata: Metadata = {
  title: 'Area manager - Mangwaoo',
};

// Everything under /asm is for an Area Sales Manager whose post still exists: anyone else is sent to log in. The pages share
// this frame (sidebar and the notification bell); the website's navbar and footer are hidden here (HideOnDashboardRoutes).
export default async function AsmLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session || session.role !== 'ASM') redirect('/login?next=/asm');

  const manager = await findManager(session.userId);

  // The super admin removed the post: nothing to manage any more.
  if (!manager) redirect('/login');

  return (
    <AsmShell name={manager.name} areaName={manager.areaName}>
      {children}
    </AsmShell>
  );
}
