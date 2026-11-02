'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

type RiderCommission = { id: string; name: string; amount: number };

const pkr = (value: number) => `PKR ${Math.round(value).toLocaleString('en-IN')}`;

export default function SuperCommissionBreakdown({ riders, total }: { riders: RiderCommission[]; total: number }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="rounded-sm text-left font-bold text-ink underline decoration-dotted underline-offset-4 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {pkr(total)}
      </button>
      {open ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="commission-breakdown-title" className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-2xl sm:rounded-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 id="commission-breakdown-title" className="text-lg font-bold text-ink">Rider commission breakdown</h2>
                <p className="mt-1 text-sm text-brand-gray">Total collected: {pkr(total)}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-2 text-brand-gray hover:bg-brand-light hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>
            {riders.length === 0 ? (
              <p className="rounded-xl bg-brand-light p-4 text-sm text-brand-gray">No rider commissions recorded yet.</p>
            ) : (
              <ul className="divide-y divide-gray-200">
                {riders.map((rider) => (
                  <li key={rider.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <span className="min-w-0 truncate font-medium text-ink">{rider.name}</span>
                    <span className="shrink-0 font-semibold text-accent">{pkr(rider.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={() => setOpen(false)} className="mt-5 w-full rounded-xl bg-brand-dark px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">Done</button>
          </section>
        </div>
      ) : null}
    </>
  );
}
