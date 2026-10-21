'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Mail, Lock, Eye, EyeOff, X, Smartphone } from 'lucide-react';
import WhatsAppCodeForm from '@/components/WhatsAppCodeForm';
import { useAuth } from '@/lib/auth-context';
import type { PhoneVerificationInfo } from '@/lib/phone-verification-types';

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" aria-hidden="true">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.89h2.78l-.44 2.91h-2.34V22c4.78-.79 8.44-4.94 8.44-9.94Z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.73-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.26a12 12 0 0 0 0 10.76l4.01-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.26 6.62l4.01 3.1C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

export default function SignInModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { refresh } = useAuth();
  // Set when the password was right but the WhatsApp number was never confirmed: the code screen takes over.
  const [verification, setVerification] = useState<PhoneVerificationInfo | null>(null);
  const [formData, setFormData] = useState({ email: '', password: '', remember: false });
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) {
    return null;
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
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

      await refresh();
      onClose();
    } catch {
      setFormError('Could not reach the server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerified = async () => {
    await refresh();
    onClose();
  };

  const handleSocialLogin = (provider: 'Google' | 'Facebook') => {
    alert(`Continue with ${provider} will be available once the Mangwaoo app backend launches.`);
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-surface shadow-2xl grid grid-cols-1 md:grid-cols-2">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full border border-white/30 bg-black/20 p-2 text-white hover:bg-black/30 md:border-gray-200 md:bg-surface md:text-ink md:hover:bg-gray-100"
          aria-label="Close sign in"
        >
          <X size={18} />
        </button>

        <div className="flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-brand-red-primary to-brand-red-secondary p-8 text-center text-white">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">Coming soon</span>
          </div>
          <h3 className="text-2xl font-bold">Get the Mangwaoo App</h3>
          <p className="max-w-xs text-sm text-white/85">
            The Mangwaoo app for Android &amp; iOS is launching soon.
          </p>
        </div>

        <div className="p-8">
          {verification ? (
            <WhatsAppCodeForm
              key={verification.ticket}
              verification={verification}
              remember={formData.remember}
              title="Confirm your WhatsApp"
              verifyLabel="Verify and log in"
              backLabel="Back to log in"
              onBack={() => setVerification(null)}
              onVerified={handleVerified}
            />
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-ink mb-1">Log in</h2>
                <p className="text-sm text-brand-gray">
                  New to Mangwaoo?{' '}
                  <Link
                    href="/signup"
                    onClick={onClose}
                    className="font-semibold text-accent hover:underline"
                  >
                    Create an account
                  </Link>
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-ink mb-2">Email</label>
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
                    <label className="block text-sm font-semibold text-ink">Password</label>
                    <Link
                      href="/forgot-password"
                      onClick={onClose}
                      className="text-xs font-semibold text-accent hover:underline"
                    >
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

              <div className="flex items-center gap-3 my-6">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs text-brand-gray uppercase tracking-wide">or</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => handleSocialLogin('Google')}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 py-3 text-sm font-semibold text-ink hover:bg-gray-50 transition-colors"
                >
                  <GoogleIcon />
                  Continue with Google
                </button>
                <button
                  type="button"
                  onClick={() => handleSocialLogin('Facebook')}
                  className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#1877F2] py-3 text-sm font-semibold text-white hover:bg-[#166fe0] transition-colors"
                >
                  <FacebookIcon />
                  Continue with Facebook
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
