'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ImageUp, RotateCcw, UserRound } from 'lucide-react';
import { compressImage } from '@/lib/client-image';
import { MAX_RIDER_DOCUMENT_BYTES } from '@/lib/rider-documents';

const FACE_MAX_DIMENSION = 1000;

/**
 * Where a rider adds a clear photo of their face. "Take a selfie" opens the phone's own camera (on a computer it opens the
 * file chooser), "Choose photo" picks one from the gallery. The browser shrinks the picture; it stays in memory only
 * (never written to browser storage) until the form sends it.
 */
export default function FaceCapture({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: Blob | null;
  onChange: (blob: Blob | null) => void;
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const previewUrl = useMemo(() => (value ? URL.createObjectURL(value) : null), [value]);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsProcessing(true);
    setError('');

    try {
      const photo = await compressImage(file, { maxDimension: FACE_MAX_DIMENSION });

      if (photo.size > MAX_RIDER_DOCUMENT_BYTES) {
        setError('This photo is too large. Please try another one.');
        return;
      }

      onChange(photo);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div>
      <p className="mb-2 block text-sm font-semibold text-ink">{label}</p>

      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div className="relative h-36 w-36 shrink-0 overflow-hidden rounded-2xl border-2 border-dashed border-gray-300 bg-brand-light">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local preview of an unsaved photo
            <img src={previewUrl} alt="Your face photo preview" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-brand-gray">
              <UserRound className="h-12 w-12" aria-hidden="true" />
              <span className="text-xs">{isProcessing ? 'Preparing photo…' : 'No photo yet'}</span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="mb-3 text-xs text-brand-gray">{hint}</p>
          <div className="flex flex-wrap gap-2">
            {previewUrl ? (
              <button
                type="button"
                onClick={() => onChange(null)}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-4 py-2 text-xs font-semibold text-ink hover:border-accent hover:text-accent disabled:opacity-60"
              >
                <RotateCcw className="h-4 w-4" />
                Retake
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => selfieInputRef.current?.click()}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-red-primary px-4 py-2 text-xs font-semibold text-white hover:bg-brand-red-secondary disabled:opacity-60"
                >
                  <Camera className="h-4 w-4" />
                  Take a selfie
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-4 py-2 text-xs font-semibold text-ink hover:border-accent hover:text-accent disabled:opacity-60"
                >
                  <ImageUp className="h-4 w-4" />
                  Choose photo
                </button>
              </>
            )}
          </div>
          {error ? (
            <p role="alert" className="mt-2 text-xs text-danger">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      {/* `capture="user"` asks a phone for its front camera; other browsers just open the file chooser. */}
      <input ref={selfieInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleFile} />
      <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}
