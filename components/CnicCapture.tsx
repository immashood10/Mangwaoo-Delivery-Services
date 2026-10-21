'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, ImageUp, RotateCcw, ScanLine, X } from 'lucide-react';
import { captureVideoRegion, compressImage } from '@/lib/client-image';
import { MAX_RIDER_DOCUMENT_BYTES } from '@/lib/rider-documents';

/** Full-screen camera with an ID-card-shaped guide; captures just the card area. */
function CnicScanner({
  title,
  onCapture,
  onClose,
}: {
  title: string;
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError('The camera only works on a secure (https) page. Please use “Upload photo” instead.');
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
      } catch {
        if (!cancelled) setError('Could not open the camera. Please allow camera access or use “Upload photo”.');
        return;
      }

      if (cancelled || !videoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => undefined);
      if (!cancelled) setIsReady(true);
    })();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const handleCapture = async () => {
    if (!videoRef.current || !frameRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      onCapture(await captureVideoRegion(videoRef.current, frameRef.current));
    } catch (err) {
      setError((err as Error).message);
      setIsCapturing(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col bg-black text-white">
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
          <p className="rounded-full bg-black/60 px-4 py-1.5 text-center text-sm font-semibold">{title}</p>
          {/* ID-1 card ratio (85.6 × 54 mm); the shadow dims everything outside the frame. */}
          <div
            ref={frameRef}
            className="relative aspect-[1.586] w-[88%] max-w-xl rounded-2xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
          >
            {isReady && <ScanLine className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-white/40" />}
          </div>
          <p className="max-w-xs text-center text-xs text-white/80">
            Keep the whole card inside the frame, flat and well lit, with no glare on the text.
          </p>
          {error ? <p className="max-w-sm rounded-lg bg-red-600/90 px-4 py-2 text-center text-sm">{error}</p> : null}
          {!isReady && !error ? <p className="text-sm text-white/80">Opening camera…</p> : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 bg-black px-6 py-5">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/10"
        >
          <X className="h-4 w-4" />
          Cancel
        </button>
        <button
          type="button"
          onClick={handleCapture}
          disabled={!isReady || isCapturing}
          className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-brand-red-primary transition hover:bg-brand-red-secondary disabled:opacity-40"
          aria-label="Capture photo"
        >
          <Camera className="h-6 w-6" />
        </button>
        <span className="w-[88px]" aria-hidden />
      </div>
    </div>,
    document.body
  );
}

export default function CnicCapture({
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
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The photo stays in memory only (never written to browser storage) until signup submits it.
  const previewUrl = useMemo(() => (value ? URL.createObjectURL(value) : null), [value]);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const accept = (blob: Blob) => {
    if (blob.size > MAX_RIDER_DOCUMENT_BYTES) {
      setError('This photo is too large. Please try again.');
      return;
    }
    setError('');
    onChange(blob);
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsProcessing(true);
    try {
      accept(await compressImage(file));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div>
      <p className="mb-2 block text-sm font-semibold text-brand-dark">{label}</p>

      {previewUrl ? (
        <div className="relative overflow-hidden rounded-xl border border-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element -- local preview of an unsaved photo */}
          <img src={previewUrl} alt={`${label} preview`} className="aspect-[1.586] w-full bg-gray-50 object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/80"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Retake
          </button>
        </div>
      ) : (
        <div className="flex aspect-[1.586] w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-4 text-center">
          <p className="text-xs text-brand-gray">{isProcessing ? 'Preparing photo…' : hint}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-red-primary px-4 py-2 text-xs font-semibold text-white hover:bg-brand-red-secondary disabled:opacity-60"
            >
              <ScanLine className="h-4 w-4" />
              Scan with camera
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-brand-dark hover:border-brand-red-primary hover:text-brand-red-primary disabled:opacity-60"
            >
              <ImageUp className="h-4 w-4" />
              Upload photo
            </button>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}

      {isScannerOpen && (
        <CnicScanner
          title={`Scan ${label.toLowerCase()}`}
          onClose={() => setIsScannerOpen(false)}
          onCapture={(blob) => {
            setIsScannerOpen(false);
            accept(blob);
          }}
        />
      )}
    </div>
  );
}
