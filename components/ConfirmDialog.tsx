'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * "Are you sure?" in front of something that can't be undone: a question, the two buttons (Cancel goes back, Confirm
 * does it) and, under them, a small line saying what will happen. `onConfirm` answers with an error message to show in
 * the dialog, or null when it worked (the caller then closes the dialog).
 */
export default function ConfirmDialog({
  title,
  message,
  note,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  /** The small line under the buttons, e.g. what will be removed. */
  note?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => Promise<string | null>;
  onCancel: () => void;
}) {
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState('');
  const cancelRef = useRef<HTMLButtonElement>(null);

  // The safe choice has the focus, so Enter / Space can't confirm by accident.
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isWorking) onCancel();
    };

    window.addEventListener('keydown', handleKey);

    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel, isWorking]);

  const handleConfirm = async () => {
    setIsWorking(true);
    setError('');

    const problem = await onConfirm();

    // On success the caller closes the dialog; only a problem keeps it open.
    if (problem) {
      setError(problem);
      setIsWorking(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => event.target === event.currentTarget && !isWorking && onCancel()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-2xl"
      >
        <h2 id="confirm-dialog-title" className="text-lg font-bold text-ink">
          {title}
        </h2>
        <p id="confirm-dialog-message" className="mt-2 text-sm text-ink">
          {message}
        </p>

        {error ? (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={isWorking}
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-gray-50 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isWorking}
            className="rounded-xl bg-brand-red-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-secondary disabled:opacity-60"
          >
            {isWorking ? 'Please wait…' : confirmLabel}
          </button>
        </div>

        {note ? <p className="mt-3 text-center text-xs text-brand-gray">{note}</p> : null}
      </div>
    </div>,
    document.body
  );
}
