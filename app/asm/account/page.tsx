import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { findManager } from '@/lib/area-managers';
import { PasswordForm } from '@/components/AccountSettings';

export default async function AsmAccountPage() {
  const session = await getSession();

  if (!session || session.role !== 'ASM') redirect('/login?next=/asm/account');

  const [manager, user] = await Promise.all([
    findManager(session.userId),
    prisma.user.findUnique({ where: { id: session.userId }, select: { email: true, phone: true } }),
  ]);

  if (!manager || !user) redirect('/login');

  const details = [
    { label: 'Name', value: manager.name },
    { label: 'Login name', value: user.email },
    { label: 'Phone', value: user.phone ?? '—' },
    { label: 'Area', value: manager.areaName },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-ink">My account</h1>

      <section aria-labelledby="manager-details" className="rounded-2xl bg-surface p-6 shadow-soft">
        <h2 id="manager-details" className="mb-4 text-lg font-bold text-ink">
          Area Sales Manager
        </h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          {details.map((detail) => (
            <div key={detail.label}>
              <dt className="text-xs text-brand-gray">{detail.label}</dt>
              <dd className="mt-0.5 break-words text-sm font-semibold text-ink">{detail.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-brand-gray">Mangwaoo sets your name, login name and area. Ask the super admin if one of them needs to change.</p>
      </section>

      <PasswordForm />
    </div>
  );
}
