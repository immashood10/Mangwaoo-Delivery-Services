'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

/** Shown on the Favourites page to someone who isn't logged in: favourites belong to an account. */
export default function FavouritesLoginPrompt() {
  const { isLoading, openSignIn } = useAuth();

  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-red-primary/10">
        <Heart className="h-8 w-8 text-accent" />
      </div>
      <h1 className="mb-2 text-2xl font-bold text-ink">Log in to see your favourites</h1>
      <p className="mb-8 text-brand-gray">
        Save restaurants and dishes with the heart and they&apos;ll be waiting here, on any phone or computer you log in on.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={openSignIn}
          disabled={isLoading}
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-brand-red-primary to-brand-red-secondary px-6 py-3 text-sm font-semibold text-white transition-all hover:shadow-lg disabled:opacity-60"
        >
          Log in
        </button>
        <Link
          href="/signup"
          className="inline-flex items-center justify-center rounded-xl border-2 border-accent px-6 py-3 text-sm font-semibold text-accent transition-colors hover:bg-brand-red-primary hover:text-white"
        >
          Create an account
        </Link>
      </div>
    </div>
  );
}
