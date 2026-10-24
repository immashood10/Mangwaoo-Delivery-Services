'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { compressImage } from '@/lib/client-image';
import { COVER_MAX_DIMENSION, MAX_COVER_BYTES } from '@/lib/seller-cover-config';

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read this picture. Please try another one.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Chooses a food seller's restaurant background picture. The picture is shrunk in the browser and handed to the parent
 * as a data URL (`onPick`); the parent sends it with the rest of the form. `preview` is what to show now: a picture
 * already saved (its address) or the one just chosen (a data URL).
 */
export default function CoverPhotoPicker({
  preview,
  onPick,
  onRemove,
  disabled = false,
}: {
  preview: string | null;
  onPick: (dataUrl: string) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    // Clearing the field lets the same file be chosen again after removing it.
    event.target.value = '';

    if (!file) return;

    setError('');
    setIsPreparing(true);

    try {
      const blob = await compressImage(file, { maxDimension: COVER_MAX_DIMENSION, quality: 0.8 });

      if (blob.size > MAX_COVER_BYTES) {
        setError('This picture is too large. Please choose a smaller one.');
        return;
      }

      onPick(await blobToDataUrl(blob));
    } catch (caught) {
      setError((caught as Error).message || 'Could not read this picture. Please try a JPG or PNG image.');
    } finally {
      setIsPreparing(false);
    }
  };

  return (
    <div>
      <div className="relative aspect-[16/7] w-full overflow-hidden rounded-xl border border-dashed border-gray-300 bg-brand-light">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data URL just chosen, or the saved picture's address
          <img src={preview} alt="Restaurant background preview" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-4 text-center text-brand-gray">
            <ImagePlus className="h-7 w-7" aria-hidden="true" />
            <span className="text-xs">No background picture yet</span>
          </div>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isPreparing}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ImagePlus className="h-4 w-4" aria-hidden="true" />
          {isPreparing ? 'Preparing…' : preview ? 'Change picture' : 'Choose picture'}
        </button>
        {preview ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled || isPreparing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Remove
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFile}
        className="sr-only"
        tabIndex={-1}
        aria-label="Restaurant background picture"
      />

      {error ? (
        <p className="mt-1.5 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
