'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import AuthBrandPanel from '@/components/AuthBrandPanel';

export default function ResetPassword() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');

    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setFormError(data?.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setIsSubmitted(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch {
      setFormError('Could not reach the server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] grid grid-cols-1 lg:grid-cols-2">
      <AuthBrandPanel
        title="Set a new password"
        subtitle="Choose a strong password to get back into your Mangwaoo account."
      />

      <div className="flex items-center justify-center px-4 py-12 sm:px-6 lg:px-12 bg-surface">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          {!token ? (
            <div className="text-center">
              <h1 className="text-2xl font-bold text-ink mb-2">Invalid link</h1>
              <p className="text-brand-gray mb-8">
                This reset link is missing its token. Please request a new one.
              </p>
              <Link href="/forgot-password" className="text-sm font-semibold text-accent hover:underline">
                Request a new link
              </Link>
            </div>
          ) : isSubmitted ? (
            <div className="text-center">
              <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-ink mb-2">Password reset!</h1>
              <p className="text-brand-gray">Taking you to log in…</p>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-ink mb-2">Set a new password</h1>
                <p className="text-brand-gray">Enter and confirm your new password below.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-ink mb-2">New password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                    <input
                      type={isPasswordVisible ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter a new password"
                      className="w-full pl-11 pr-11 py-3 border border-gray-300 rounded-xl outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setIsPasswordVisible((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-gray hover:text-accent"
                      aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                    >
                      {isPasswordVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-ink mb-2">Confirm password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                    <input
                      type={isPasswordVisible ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Re-enter your new password"
                      className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
                      required
                      minLength={8}
                    />
                  </div>
                </div>

                {formError ? <p className="text-sm text-danger">{formError}</p> : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-brand-red-primary to-brand-red-secondary text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Resetting…' : 'Reset password'}
                </button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
