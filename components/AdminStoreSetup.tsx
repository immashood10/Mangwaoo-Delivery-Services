'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store } from 'lucide-react';

/** The one-time button that creates Mangwaoo's own store in MangwaooMart. */
export default function AdminStoreSetup() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const create = async () => {
    setBusy(true);
    setError('');

    try {
      const response = await fetch('/api/admin/store', { method: 'POST' });
      const data = await response.json().catch(() => null);

      if (!response.ok) setError(data?.error ?? 'Could not create the store. Please try again.');
      else router.refresh();
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl bg-surface p-8 text-center shadow-soft">
      <p className="mb-4 text-sm text-brand-gray">
        Mangwaoo does not have its own store in MangwaooMart yet. Create it once: customers will see the products you post here under the
        name &ldquo;Mangwaoo&rdquo;.
      </p>
      {error ? (
        <p role="alert" className="mb-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void create()}
        disabled={busy}
        data-testid="create-store"
        className="inline-flex items-center gap-2 rounded-xl bg-brand-red-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-secondary disabled:opacity-60"
      >
        <Store className="h-4 w-4" />
        {busy ? 'Creating…' : 'Create the Mangwaoo store'}
      </button>
    </div>
  );
}
