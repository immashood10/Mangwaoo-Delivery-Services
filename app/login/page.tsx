'use client';

import { Suspense, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import AuthBrandPanel from '@/components/AuthBrandPanel';
import WhatsAppCodeForm from '@/components/WhatsAppCodeForm';
import { useAuth } from '@/lib/auth-context';
import type { PhoneVerificationInfo } from '@/lib/phone-verification-types';

export default function Login() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuth();
  // Set when the password was right but the WhatsApp number was never confirmed: the code screen takes over.
  const [verification, setVerification] = useState<PhoneVerificationInfo | null>(null);
  const [formData, setFormData] = useState({ email: '', password: '', remember: false });
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          remember: formData.remember,
        }),
      });

      const data = await response.json();

      if (data.verification) {
        setVerification(data.verification);
        return;
      }

      if (!response.ok) {
        setFormError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      await finishLogin();
    } catch {
      setFormError('Could not reach the server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const finishLogin = async () => {
    await refresh();
    const next = searchParams.get('next');
    router.push(next && next.startsWith('/') ? next : '/');
    router.refresh();
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] grid grid-cols-1 lg:grid-cols-2">
      <AuthBrandPanel
        title="Welcome back to Mangwaoo"
        subtitle="Log in to track your orders, save your favorite addresses, and reorder in seconds."
      />

      <div className="flex items-center justify-center px-4 py-12 sm:px-6 lg:px-12 bg-surface">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          {verification ? (
            <WhatsAppCodeForm
              key={verification.ticket}
              verification={verification}
              remember={formData.remember}
              title="Confirm your WhatsApp"
              verifyLabel="Verify and log in"
              backLabel="Back to log in"
              onBack={() => setVerification(null)}
              onVerified={finishLogin}
            />
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-ink mb-2">Log in</h1>
                <p className="text-brand-gray">
                  New to Mangwaoo?{' '}
                  <Link href="/signup" className="text-accent font-semibold hover:underline">
                    Create an account
                  </Link>
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-ink mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                    <input
                      // text, not email: the admin account logs in with the username "admin"
                      type="text"
                      inputMode="email"
                      autoComplete="username"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="your@email.com"
                      className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-ink">
                      Password
                    </label>
                    <Link href="/forgot-password" className="text-xs font-semibold text-accent hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                    <input
                      type={isPasswordVisible ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Enter your password"
                      className="w-full pl-11 pr-11 py-3 border border-gray-300 rounded-xl outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
                      required
                      minLength={6}
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

                <label className="flex items-center gap-2 text-sm text-brand-gray">
                  <input
                    type="checkbox"
                    name="remember"
                    checked={formData.remember}
                    onChange={handleChange}
                    className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent"
                  />
                  Remember me
                </label>

                {formError ? <p className="text-sm text-danger">{formError}</p> : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-brand-red-primary to-brand-red-secondary text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Logging in…' : 'Log in'}
                </button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
