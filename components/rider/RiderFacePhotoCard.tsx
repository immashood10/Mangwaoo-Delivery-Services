'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import FaceCapture from '@/components/FaceCapture';

/**
 * For a rider who signed up before the face photo was required: they add it here, so their application can be approved.
 * (New riders give it in the signup form.) It can only be added once; see `POST /api/rider/face-photo`.
 */
export default function RiderFacePhotoCard() {
  const router = useRouter();
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!photo) return;

    setIsSaving(true);
    setError('');

    try {
      const body = new FormData();
      body.set('facePhoto', photo, 'face.jpg');

      const response = await fetch('/api/rider/face-photo', { method: 'POST', body });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? 'Could not save your photo. Please try again.');
        return;
      }

      // The page is built on the server, so it learns that the photo is on file by asking for it again.
      router.refresh();
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5" aria-label="Add your face photo">
      <h2 className="text-lg font-bold text-ink">Add your face photo</h2>
      <p className="mt-1 mb-4 text-sm text-brand-gray">
        Every rider now gives a clear photo of their face, and your application can&apos;t be approved without it. Please add yours.
      </p>

      <FaceCapture
        label="Your face photo"
        hint="Look straight at the camera in good light, with no sunglasses, cap or mask."
        value={photo}
        onChange={setPhoto}
      />

      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleSave}
        disabled={!photo || isSaving}
        className="mt-4 rounded-full bg-brand-red-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-secondary disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? 'Saving…' : 'Save my photo'}
      </button>
    </section>
  );
}
