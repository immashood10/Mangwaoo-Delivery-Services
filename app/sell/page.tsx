'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Store, User, Mail, Phone, Lock, Eye, EyeOff, MapPin, Globe } from 'lucide-react';
import AuthBrandPanel from '@/components/AuthBrandPanel';
import LocationPicker, { type PickedLocation } from '@/components/LocationPicker';
import WhatsAppCodeForm from '@/components/WhatsAppCodeForm';
import { useAuth } from '@/lib/auth-context';
import { DEFAULT_COUNTRY, MAX_PLACE_LENGTH, PAKISTAN_CITIES } from '@/lib/locations';
import type { PhoneVerificationInfo, VerifiedUser } from '@/lib/phone-verification-types';

type Mode = 'signup' | 'signin';
type SellerType = 'MART' | 'GULPLAZA_OWNER';

const SELLER_TYPE_OPTIONS: { value: SellerType; label: string; description: string }[] = [
  {
    value: 'MART',
    label: 'MangwaooMart Vendor',
    description: 'Groceries, dairy, and everyday essentials',
  },
  {
    value: 'GULPLAZA_OWNER',
    label: 'Food Business Owner',
    description: 'Restaurants, home kitchens, bakeries, and food vendors',
  },
];

export default function SellOnMangwaoo() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [mode, setMode] = useState<Mode>('signup');
  // Set after sign up (or a log in with a never-confirmed number): the WhatsApp code must be entered first.
  const [verification, setVerification] = useState<PhoneVerificationInfo | null>(null);

  const [signupData, setSignupData] = useState({
    businessName: '',
    fullName: '',
    email: '',
    phone: '',
    city: '',
    country: DEFAULT_COUNTRY,
    password: '',
    confirmPassword: '',
    sellerType: 'MART' as SellerType,
  });
  // Food businesses pin their kitchen on the map so nearby customers find them first in search.
  const [shopLocation, setShopLocation] = useState<PickedLocation | null>(null);
  const [signinData, setSigninData] = useState({ email: '', password: '' });

  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignupChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setSignupData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSigninChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setSigninData((prev) => ({ ...prev, [name]: value }));
  };

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setFormError('');
  };

  const handleSignupSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (signupData.password !== signupData.confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setFormError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/seller-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: signupData.businessName,
          fullName: signupData.fullName,
          email: signupData.email,
          phone: signupData.phone,
          city: signupData.city,
          country: signupData.country,
          password: signupData.password,
          sellerType: signupData.sellerType,
          ...(signupData.sellerType !== 'MART' && shopLocation ? { location: shopLocation } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setFormError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      if (data.verification) {
        setVerification(data.verification);
      } else {
        await handleVerified(data.user);
      }
    } catch {
      setFormError('Could not reach the server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerified = async (user: VerifiedUser) => {
    if (user.role !== 'SELLER') {
      await fetch('/api/auth/logout', { method: 'POST' });
      setVerification(null);
      setMode('signin');
      setFormError('This account is not registered as a seller.');
      return;
    }

    await refresh();
    router.push('/seller');
    router.refresh();
  };

  const handleSigninSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: signinData.email, password: signinData.password }),
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

      if (data.user?.role !== 'SELLER') {
        await fetch('/api/auth/logout', { method: 'POST' });
        setFormError('This account is not registered as a seller.');
        return;
      }

      await refresh();
      router.push('/seller');
      router.refresh();
    } catch {
      setFormError('Could not reach the server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] grid grid-cols-1 lg:grid-cols-2">
      <AuthBrandPanel
        title="Grow your business on MangwaooMart"
        subtitle="List your shop, reach more customers across Karachi, and manage orders through your Mangwaoo seller account."
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
              backLabel={mode === 'signup' ? 'Change my details' : 'Back to log in'}
              onBack={() => setVerification(null)}
              onVerified={handleVerified}
            />
          ) : (
            <>
              <div className="mb-8">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-red-primary/10 px-4 py-2 text-sm font-semibold text-accent">
                  <Store className="w-4 h-4" />
                  Sell on Mangwaoo
                </div>
                <h1 className="text-3xl font-bold text-ink mb-2">
                  {mode === 'signup' ? 'Become a seller' : 'Seller log in'}
                </h1>
                <p className="text-brand-gray">
                  {mode === 'signup' ? (
                    <>
                      Already have a seller account?{' '}
                      <button
                        type="button"
                        onClick={() => switchMode('signin')}
                        className="text-accent font-semibold hover:underline"
                      >
                        Log in
                      </button>
                    </>
                  ) : (
                    <>
                      New to selling on Mangwaoo?{' '}
                      <button
                        type="button"
                        onClick={() => switchMode('signup')}
                        className="text-accent font-semibold hover:underline"
                      >
                        Create a seller account
                      </button>
                    </>
                  )}
                </p>
              </div>

              {mode === 'signup' ? (
                <form onSubmit={handleSignupSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-ink mb-2">
                      Shop / Business Name
                    </label>
                    <div className="relative">
                      <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                      <input
                        type="text"
                        name="businessName"
                        value={signupData.businessName}
                        onChange={handleSignupChange}
                        placeholder="e.g. Karachi Grocers"
                        className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-ink mb-2">
                      What are you selling?
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {SELLER_TYPE_OPTIONS.map((option) => (
                        <label
                          key={option.value}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                            signupData.sellerType === option.value
                              ? 'border-accent bg-red-50'
                              : 'border-gray-200 hover:border-accent'
                          }`}
                        >
                          <input
                            type="radio"
                            name="sellerType"
                            value={option.value}
                            checked={signupData.sellerType === option.value}
                            onChange={handleSignupChange}
                            className="mt-1 h-4 w-4 border-gray-300 text-accent focus:ring-accent"
                          />
                          <span>
                            <span className="block text-sm font-semibold text-ink">{option.label}</span>
                            <span className="block text-xs text-brand-gray">{option.description}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                    {signupData.sellerType !== 'MART' && (
                      <p className="mt-2 text-xs text-brand-gray">
                        Food Business accounts are manually reviewed before your listings go live.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-ink mb-2">
                      Owner Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                      <input
                        type="text"
                        name="fullName"
                        value={signupData.fullName}
                        onChange={handleSignupChange}
                        placeholder="Your full name"
                        className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-ink mb-2">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                      <input
                        type="email"
                        name="email"
                        value={signupData.email}
                        onChange={handleSignupChange}
                        placeholder="your@email.com"
                        className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-ink mb-2">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                      <input
                        type="tel"
                        name="phone"
                        value={signupData.phone}
                        onChange={handleSignupChange}
                        placeholder="0300-1234567"
                        className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-ink mb-2">
                        City
                      </label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                        <input
                          type="text"
                          name="city"
                          value={signupData.city}
                          onChange={handleSignupChange}
                          placeholder="e.g. Karachi"
                          list="seller-city-list"
                          maxLength={MAX_PLACE_LENGTH}
                          autoComplete="address-level2"
                          className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
                          required
                        />
                        <datalist id="seller-city-list">
                          {PAKISTAN_CITIES.map((city) => (
                            <option key={city} value={city} />
                          ))}
                        </datalist>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-ink mb-2">
                        Country
                      </label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                        <input
                          type="text"
                          name="country"
                          value={signupData.country}
                          onChange={handleSignupChange}
                          maxLength={MAX_PLACE_LENGTH}
                          autoComplete="country-name"
                          className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {signupData.sellerType !== 'MART' && (
                    <div>
                      <span className="block text-sm font-semibold text-ink mb-2">Restaurant location (optional)</span>
                      <LocationPicker
                        value={shopLocation}
                        onChange={setShopLocation}
                        placeholder="Search your shop, area or street"
                        changeLabel="Change restaurant location"
                      />
                      <p className="mt-1.5 text-xs text-brand-gray">
                        Customers near you see your restaurant first when they search for food. You can add or change this
                        later in Settings.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-ink mb-2">
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                        <input
                          type={isPasswordVisible ? 'text' : 'password'}
                          name="password"
                          value={signupData.password}
                          onChange={handleSignupChange}
                          placeholder="Min. 6 chars"
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
                      <label className="block text-sm font-semibold text-ink mb-2">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                        <input
                          type={isPasswordVisible ? 'text' : 'password'}
                          name="confirmPassword"
                          value={signupData.confirmPassword}
                          onChange={handleSignupChange}
                          placeholder="Re-enter"
                          className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
                          required
                          minLength={8}
                        />
                      </div>
                    </div>
                  </div>

                  {formError ? <p className="text-sm text-danger">{formError}</p> : null}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-brand-red-primary to-brand-red-secondary text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? 'Sending code…' : 'Create seller account'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSigninSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-ink mb-2">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                      <input
                        type="email"
                        name="email"
                        value={signinData.email}
                        onChange={handleSigninChange}
                        placeholder="your@email.com"
                        className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-ink mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray" />
                      <input
                        type={isPasswordVisible ? 'text' : 'password'}
                        name="password"
                        value={signinData.password}
                        onChange={handleSigninChange}
                        placeholder="Enter your password"
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

                  {formError ? <p className="text-sm text-danger">{formError}</p> : null}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-brand-red-primary to-brand-red-secondary text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? 'Logging in…' : 'Log in'}
                  </button>
                </form>
              )}
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
