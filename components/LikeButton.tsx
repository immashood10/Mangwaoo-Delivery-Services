'use client';

import { useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

/** Heart button with a like count. Guests are asked to sign in first. */
export default function LikeButton({
  productId,
  initialLiked,
  initialCount,
}: {
  productId: string;
  initialLiked: boolean;
  initialCount: number;
}) {
  const { user, isLoading, openSignIn } = useAuth();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [error, setError] = useState('');
  const isSaving = useRef(false);

  const handleClick = async () => {
    if (isLoading || isSaving.current) return;

    if (!user) {
      openSignIn();
      return;
    }

    const next = !liked;
    isSaving.current = true;
    setError('');
    // Optimistic: flip right away, then settle on what the server says.
    setLiked(next);
    setCount((current) => Math.max(0, current + (next ? 1 : -1)));

    try {
      const response = await fetch(`/api/products/${productId}/like`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liked: next }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? 'Could not save your like.');
      }

      setLiked(data.liked);
      setCount(data.count);
    } catch (caught) {
      setLiked(!next);
      setCount((current) => Math.max(0, current + (next ? -1 : 1)));
      setError(caught instanceof Error ? caught.message : 'Could not save your like.');
    } finally {
      isSaving.current = false;
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={liked}
        aria-label={liked ? 'Unlike this ad' : 'Like this ad'}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
          liked
            ? 'border-accent bg-brand-red-primary/10 text-accent'
            : 'border-gray-200 text-ink hover:border-accent hover:text-accent'
        }`}
      >
        <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
        <span>{liked ? 'Liked' : 'Like'}</span>
        {count > 0 ? <span className="text-xs font-medium text-brand-gray">{count}</span> : null}
      </button>
      {error ? (
        <p role="alert" className="absolute right-0 top-full z-10 mt-2 w-56 rounded-xl border border-gray-100 bg-surface p-3 text-xs text-danger shadow-lg">
          {error}
        </p>
      ) : null}
    </div>
  );
}
