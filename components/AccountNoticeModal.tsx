'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Ban } from 'lucide-react';
import type { AccountNotice } from '@/lib/ban-duration';

/**
 * Shown once, at the moment a logged-in person is logged out because an admin banned (or deleted) their account:
 * "You have been banned for 7 days from Mangwaoo". It lives in the page only; nothing is stored in the browser.
 */
export default function AccountNoticeModal({ notice, onClose }: { notice: AccountNotice; onClose: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    buttonRef.current?.focus();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKey);

    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="account-notice-title"
      aria-describedby="account-notice-details"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-danger">
          <Ban className="h-7 w-7" />
        </div>
        <h2 id="account-notice-title" className="text-xl font-bold text-ink">
          {notice.headline}
        </h2>
        <div id="account-notice-details" className="mt-3 space-y-1.5 text-sm text-brand-gray">
          {notice.details.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <button
          ref={buttonRef}
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-brand-red-primary to-brand-red-secondary py-3 text-sm font-semibold text-white hover:shadow-lg"
        >
          OK
        </button>
      </div>
    </div>,
    document.body
  );
}
