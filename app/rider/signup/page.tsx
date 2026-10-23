'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bike, CreditCard, Eye, EyeOff, Hash, Lock, Mail, Phone, User } from 'lucide-react';
import AuthBrandPanel from '@/components/AuthBrandPanel';
import CnicCapture from '@/components/CnicCapture';
import WhatsAppCodeForm from '@/components/WhatsAppCodeForm';
import { useAuth } from '@/lib/auth-context';
import type { PhoneVerificationInfo } from '@/lib/phone-verification-types';
import { RIDER_VEHICLE_TYPES, formatCnic, vehicleNeedsNumberPlate } from '@/lib/rider-documents';

const INPUT_CLASS =
  'w-full pl-11 pr-4 py-3 border border-gray-300 bg-transparent text-ink rounded-xl outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100';
const LABEL_CLASS = 'block text-sm font-semibold text-ink mb-2';
const ICON_CLASS = 'absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gray';

export default function RiderSignup() {
  const router = useRouter();
  const { refresh } = useAuth();
  // Set once the account is created: the code on its WhatsApp must be entered before it can log in.
  const [verification, setVerification] = useState<PhoneVerificationInfo | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    vehicleType: RIDER_VEHICLE_TYPES[0] as string,
    numberPlate: '',
    cnicNumber: '',
    password: '',
    confirmPassword: '',
  });
  // The CNIC photos stay in memory only until the form is sent (nothing is stored in the browser).
  const [cnicFront, setCnicFront] = useState<Blob | null>(null);
  const [cnicBack, setCnicBack] = useState<Blob | null>(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const needsPlate = vehicleNeedsNumberPlate(formData.vehicleType);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: name === 'cnicNumber' ? formatCnic(value) : value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    if (!cnicFront || !cnicBack) {
      setFormError('Please add a photo of the front and the back of your CNIC.');
      return;
    }

    setFormError('');
    setIsSubmitting(true);

    try {
      const body = new FormData();
      body.set('fullName', formData.fullName);
      body.set('email', formData.email);
      body.set('phone', formData.phone);
      body.set('vehicleType', formData.vehicleType);
      body.set('numberPlate', needsPlate ? formData.numberPlate : '');
      body.set('cnicNumber', formData.cnicNumber);
      body.set('password', formData.password);
      body.set('cnicFront', cnicFront, 'cnic-front.jpg');
      body.set('cnicBack', cnicBack, 'cnic-back.jpg');

      const response = await fetch('/api/auth/rider-signup', { method: 'POST', body });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setFormError(data?.error ?? 'Something went wrong. Please try again.');
        return;
      }

      if (data.verification) {
        setVerification(data.verification);
      } else {
        await handleVerified();
      }
    } catch {
      setFormError('Could not reach the server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerified = async () => {
    await refresh();
    router.push('/rider');
    router.refresh();
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] grid grid-cols-1 lg:grid-cols-2">
      <AuthBrandPanel
        title="Deliver with Mangwaoo"
        subtitle="Ride for Karachi's fastest delivery network: get order requests near you and chat with customers directly."
      />

      <div className="flex items-center justify-center px-4 py-12 sm:px-6 lg:px-12 bg-surface">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md">
          {verification ? (
            <WhatsAppCodeForm
              key={verification.ticket}
              verification={verification}
              backLabel="Change my details"
              onBack={() => setVerification(null)}
              onVerified={handleVerified}
            />
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-ink mb-2">Become a rider</h1>
                <p className="text-brand-gray">
                  Already have an account?{' '}
                  <Link href="/login" className="text-accent font-semibold hover:underline">
                    Log in
                  </Link>
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className={LABEL_CLASS}>Full Name</label>
                  <div className="relative">
                    <User className={ICON_CLASS} />
                    <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} placeholder="Your full name" className={INPUT_CLASS} required />
                  </div>
                </div>

                <div>
                  <label className={LABEL_CLASS}>Email</label>
                  <div className="relative">
                    <Mail className={ICON_CLASS} />
                    <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="your@email.com" className={INPUT_CLASS} required />
                  </div>
                </div>

                <div>
                  <label className={LABEL_CLASS}>Phone Number</label>
                  <div className="relative">
                    <Phone className={ICON_CLASS} />
                    <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="0300-1234567" className={INPUT_CLASS} required />
                  </div>
                  <p className="mt-1 text-xs text-brand-gray">A code is sent to this number to confirm it.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL_CLASS}>Vehicle</label>
                    <div className="relative">
                      <Bike className={ICON_CLASS} />
                      <select name="vehicleType" value={formData.vehicleType} onChange={handleChange} className={`${INPUT_CLASS} bg-surface`}>
                        {RIDER_VEHICLE_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {needsPlate ? (
                    <div>
                      <label className={LABEL_CLASS}>Number Plate</label>
                      <div className="relative">
                        <Hash className={ICON_CLASS} />
                        <input type="text" name="numberPlate" value={formData.numberPlate} onChange={handleChange} placeholder="KHI-1234" className={INPUT_CLASS} required />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div>
                  <label className={LABEL_CLASS}>CNIC Number</label>
                  <div className="relative">
                    <CreditCard className={ICON_CLASS} />
                    <input type="text" inputMode="numeric" name="cnicNumber" value={formData.cnicNumber} onChange={handleChange} placeholder="42101-1234567-1" className={INPUT_CLASS} required />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <CnicCapture label="CNIC front" hint="Front side of your ID card" value={cnicFront} onChange={setCnicFront} />
                  <CnicCapture label="CNIC back" hint="Back side of your ID card" value={cnicBack} onChange={setCnicBack} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL_CLASS}>Password</label>
                    <div className="relative">
                      <Lock className={ICON_CLASS} />
                      <input
                        type={isPasswordVisible ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Min. 8 chars"
                        className={`${INPUT_CLASS} pr-11`}
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setIsPasswordVisible((previous) => !previous)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-gray hover:text-accent"
                        aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                      >
                        {isPasswordVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>Confirm Password</label>
                    <div className="relative">
                      <Lock className={ICON_CLASS} />
                      <input
                        type={isPasswordVisible ? 'text' : 'password'}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        placeholder="Re-enter"
                        className={INPUT_CLASS}
                        required
                        minLength={8}
                      />
                    </div>
                  </div>
                </div>

                {formError ? <p className="text-sm text-danger">{formError}</p> : null}

                <p className="text-xs text-brand-gray">
                  Our team checks your CNIC photos and number plate and approves your account before you can start receiving orders.
                </p>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-brand-red-primary to-brand-red-secondary text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Sending code…' : 'Sign up as rider'}
                </button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
