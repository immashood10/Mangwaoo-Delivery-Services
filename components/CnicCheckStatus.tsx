'use client';

import { useState } from 'react';
import { Loader2, ScanLine } from 'lucide-react';

type TestResult = { ok: true; model: string; saw: string; seconds: number } | { ok: false; detail: string };

/** Rider Approvals: whether the AI that looks at new riders' CNIC photos is on, and a button that tests it. */
export default function CnicCheckStatus({ enabled, model }: { enabled: boolean; model: string }) {
  const [isTesting, setIsTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const runTest = async () => {
    setIsTesting(true);
    setResult(null);

    try {
      const response = await fetch('/api/admin/cnic-check', { method: 'POST' });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setResult({ ok: false, detail: data?.error ?? 'The test could not be started.' });
      } else if (data?.ok === true) {
        setResult({ ok: true, model: data.model, saw: data.saw, seconds: data.seconds });
      } else {
        setResult({ ok: false, detail: data?.detail ?? 'The test failed.' });
      }
    } catch {
      setResult({ ok: false, detail: 'Could not reach the server.' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="mb-8 rounded-2xl border border-gray-200 bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <ScanLine className="h-4 w-4 text-accent" />
            <span>
              Automatic CNIC photo check: <span className={enabled ? 'text-success' : 'text-warning'}>{enabled ? 'on' : 'off'}</span>
            </span>
          </p>
          <p className="mt-1 text-xs text-brand-gray">
            {enabled
              ? `When a rider signs up, an AI (${model}) looks at both CNIC photos and refuses a picture that is not a CNIC. You still check every photo before approving.`
              : 'To switch it on, add ANTHROPIC_API_KEY on the host (Vercel) and deploy again. Until then riders sign up as before and you check the photos yourself.'}
          </p>
        </div>

        {enabled ? (
          <button
            type="button"
            onClick={runTest}
            disabled={isTesting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanLine className="h-3.5 w-3.5" />}
            {isTesting ? 'Testing…' : 'Test it'}
          </button>
        ) : null}
      </div>

      <div aria-live="polite">
        {result ? (
          result.ok ? (
            <p className="mt-3 rounded-lg bg-green-50 px-4 py-2 text-sm text-success">
              Working: {result.model} answered in {result.seconds} s (it sees: {result.saw}).
            </p>
          ) : (
            <p className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-danger">Not working: {result.detail}</p>
          )
        ) : null}
      </div>
    </div>
  );
}
