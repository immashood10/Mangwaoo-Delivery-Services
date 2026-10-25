'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

/** The admin's log in: a username (or email) and a password, nothing else. Anyone who isn't the admin is logged out again. */
export default function AdminLoginForm() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, password: formData.password }),
      });

      const data = await response.json();

      if (!response.ok || data.verification) {
        setFormError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      // This page is only for the admin: a customer, seller or rider who got in here is logged out again.
      if (data.user?.role !== 'ADMIN') {
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
        setFormError('This page is only for the admin.');
        return;
      }

      await refresh();
      router.push('/admin');
      router.refresh();
    } catch {
      setFormError('Could not reach the server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-light px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-surface p-8 shadow-soft">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-red-primary to-brand-red-secondary">
            <span className="text-xl font-bold text-white">M</span>
          </div>
          <h1 className="text-2xl font-bold text-ink">Admin log in</h1>
          <p className="mt-1 text-sm text-brand-gray">Mangwaoo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="admin-login" className="mb-2 block text-sm font-semibold text-ink">
              Email or username
            </label>
            <input
              id="admin-login"
              // text, not email: the admin account logs in with a username
              type="text"
              name="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={formData.email}
              onChange={handleChange}
              className="w-full rounded-xl border border-gray-300 bg-transparent px-4 py-3 text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
              required
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="mb-2 block text-sm font-semibold text-ink">
              Password
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={isPasswordVisible ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                className="w-full rounded-xl border border-gray-300 bg-transparent py-3 pl-4 pr-11 text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
                required
              />
              <button
                type="button"
                onClick={() => setIsPasswordVisible((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-gray hover:text-accent"
                aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
              >
                {isPasswordVisible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {formError ? (
            <p role="alert" className="text-sm text-danger">
              {formError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-gradient-to-r from-brand-red-primary to-brand-red-secondary py-3 font-semibold text-white transition-all duration-300 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  );
}
