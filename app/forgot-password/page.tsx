'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, CheckCircle2 } from 'lucide-react';
import AuthBrandPanel from '@/components/AuthBrandPanel';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setFormError(data?.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setIsSubmitted(true);
    } catch {
      setFormError('Could not reach the server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] grid grid-cols-1 lg:grid-cols-2">
      <AuthBrandPanel
        title="Forgot your password?"
        subtitle="No worries — we'll send a reset link straight to your WhatsApp."
      />

      <div className="flex items-center justify-center px-4 py-12 sm:px-6 lg:px-12 bg-surface">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          {isSubmitted ? (
            <div className="text-center">
              <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-ink mb-2">Check your WhatsApp</h1>
              <p className="text-brand-gray mb-8">
                If an account with that email exists and has a phone number on file, we&apos;ve sent a password
                reset link to it over WhatsApp. The link expires in 30 minutes.
              </p>
              <Link href="/login" className="text-sm font-semibold text-accent hover:underline">
                Back to log in
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-ink mb-2">Reset your password</h1>
                <p className="text-brand-gray">
                  Enter the email on your account and we&apos;ll send a reset link to your WhatsApp.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-ink mb-2">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="your@email.com"
                      className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
                      required
                    />
                  </div>
                </div>

                {formError ? <p className="text-sm text-danger">{formError}</p> : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-brand-red-primary to-brand-red-secondary text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Sending…' : 'Send reset link'}
                </button>

                <p className="text-center text-sm text-brand-gray">
                  <Link href="/login" className="font-semibold text-accent hover:underline">
                    Back to log in
                  </Link>
                </p>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
