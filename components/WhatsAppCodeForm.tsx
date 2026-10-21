'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, MessageCircle, RotateCw, TriangleAlert } from 'lucide-react';
import { CODE_LENGTH, type PhoneVerificationInfo, type VerifiedUser } from '@/lib/phone-verification-types';

/**
 * The "enter the code we sent to your WhatsApp" screen shared by sign up, log in and the Settings number change.
 * The ticket and everything typed here live in React state only; the server keeps the (hashed) code.
 * Give it `key={verification.ticket}` so a new verification starts with a clean screen.
 */
export default function WhatsAppCodeForm({
  verification,
  remember = true,
  title = 'Check your WhatsApp',
  verifyLabel = 'Verify and continue',
  compact = false,
  backLabel,
  onBack,
  onVerified,
}: {
  verification: PhoneVerificationInfo;
  /** The log-in screen's "Remember me" choice, passed on so the session lasts as chosen. */
  remember?: boolean;
  title?: string;
  verifyLabel?: string;
  /** Smaller headings, for use inside a card (Settings) rather than as a whole page. */
  compact?: boolean;
  backLabel: string;
  onBack: () => void;
  onVerified: (user: VerifiedUser) => void | Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(verification.retryAfter);
  const [devCode, setDevCode] = useState(verification.devCode);
  const [mustStartAgain, setMustStartAgain] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // "Resend code in 42s" counts down once a second.
  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);

    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (code.length !== CODE_LENGTH || isVerifying || mustStartAgain) return;

    setError('');
    setNotice('');
    setIsVerifying(true);

    try {
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket: verification.ticket, code, remember }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? 'Something went wrong. Please try again.');
        setMustStartAgain(Boolean(data?.restart));
        setCode('');
        inputRef.current?.focus();
        return;
      }

      await onVerified(data.user as VerifiedUser);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setNotice('');
    setIsResending(true);

    try {
      const response = await fetch('/api/auth/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket: verification.ticket }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? 'Something went wrong. Please try again.');
        setMustStartAgain(Boolean(data?.restart));
        if (typeof data?.retryAfter === 'number') setCooldown(data.retryAfter);
        return;
      }

      setCooldown(data.verification.retryAfter);
      setDevCode(data.verification.devCode);
      setCode('');
      setNotice('A new code is on its way to your WhatsApp.');
      inputRef.current?.focus();
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div>
      <div className={compact ? 'mb-5' : 'mb-8'}>
        <div className={`mb-4 flex items-center justify-center rounded-full bg-green-50 text-success ${compact ? 'h-10 w-10' : 'h-12 w-12'}`}>
          <MessageCircle className={compact ? 'h-5 w-5' : 'h-6 w-6'} />
        </div>
        {compact ? (
          <h3 className="mb-1 text-lg font-bold text-ink">{title}</h3>
        ) : (
          <h1 className="mb-2 text-3xl font-bold text-ink">{title}</h1>
        )}
        <p className={compact ? 'text-sm text-brand-gray' : 'text-brand-gray'}>
          We sent a {CODE_LENGTH}-digit code to <span className="font-semibold text-ink">{verification.phone}</span> on
          WhatsApp. Enter it below to continue.
        </p>
      </div>

      {devCode ? (
        <div role="note" className="mb-5 flex gap-2.5 rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-sm text-warning">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>Test mode:</strong> WhatsApp isn&apos;t connected yet, so no message was sent. Your code is{' '}
            <span className="font-mono text-base font-bold tracking-widest">{devCode}</span>.
          </p>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="whatsapp-code" className="mb-2 block text-sm font-semibold text-ink">
            Verification code
          </label>
          <input
            id="whatsapp-code"
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={CODE_LENGTH}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
            placeholder={'•'.repeat(CODE_LENGTH)}
            aria-describedby="whatsapp-code-status"
            className="w-full rounded-xl border border-gray-300 bg-transparent px-4 py-3 text-center font-mono text-2xl font-bold tracking-[0.5em] text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
            required
          />
          <div id="whatsapp-code-status" aria-live="polite" className="mt-2 min-h-5 text-sm">
            {error ? <p className="text-danger">{error}</p> : null}
            {!error && notice ? <p className="text-success">{notice}</p> : null}
          </div>
        </div>

        <button
          type="submit"
          disabled={isVerifying || mustStartAgain || code.length !== CODE_LENGTH}
          className="w-full rounded-xl bg-gradient-to-r from-brand-red-primary to-brand-red-secondary py-3 font-semibold text-white transition-all duration-300 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isVerifying ? 'Verifying…' : verifyLabel}
        </button>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline">
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || isResending || mustStartAgain}
          className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline disabled:cursor-not-allowed disabled:text-brand-gray disabled:no-underline"
        >
          <RotateCw className="h-4 w-4" />
          {isResending ? 'Sending…' : cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        </button>
      </div>
    </div>
  );
}
