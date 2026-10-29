'use client';

import { useState, type FormEvent } from 'react';
import { Briefcase, CheckCircle2, Heart, House, KeyRound, MapPin, Trash2, UserRound, type LucideIcon } from 'lucide-react';
import WhatsAppCodeForm from '@/components/WhatsAppCodeForm';
import { useAuth } from '@/lib/auth-context';
import type { PhoneVerificationInfo, VerifiedUser } from '@/lib/phone-verification-types';
import { announceSavedAddressRemoved, deleteSavedAddress, getAddressTag, type AddressTag } from '@/lib/saved-addresses';

export type SettingsAddress = { id: string; label: string; street: string };

const ADDRESS_ICONS: Record<AddressTag, LucideIcon> = {
  Home: House,
  Office: Briefcase,
  Partner: Heart,
  Other: MapPin,
};

const INPUT_CLASS =
  'w-full rounded-xl border border-gray-300 bg-transparent px-4 py-2.5 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-red-100 disabled:opacity-60 read-only:bg-brand-light read-only:text-brand-gray';
const BUTTON_CLASS =
  'rounded-xl bg-gradient-to-r from-brand-red-primary to-brand-red-secondary px-6 py-2.5 text-sm font-semibold text-white hover:shadow-lg disabled:opacity-60';

type Notice = { kind: 'success' | 'error'; text: string } | null;

function NoticeLine({ notice }: { notice: Notice }) {
  if (!notice) return <p role="status" className="min-h-5 text-sm" />;

  return (
    <p
      role="status"
      className={`flex min-h-5 items-center gap-1.5 text-sm ${notice.kind === 'success' ? 'text-success' : 'text-danger'}`}
    >
      {notice.kind === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : null}
      {notice.text}
    </p>
  );
}

async function sendJson(url: string, method: 'PATCH' | 'POST', body: unknown) {
  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);

    return response.ok
      ? { ok: true as const, data }
      : { ok: false as const, error: (data?.error as string | undefined) ?? 'Something went wrong. Please try again.' };
  } catch {
    return { ok: false as const, error: 'Could not reach the server. Please try again.' };
  }
}

function ProfileForm({ initialName, initialPhone, email }: { initialName: string; initialPhone: string; email: string }) {
  const { refresh } = useAuth();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [saved, setSaved] = useState({ name: initialName, phone: initialPhone });
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  // Set while a new number waits for the code sent to its WhatsApp; the old number stays until it is entered.
  const [verification, setVerification] = useState<PhoneVerificationInfo | null>(null);

  const unchanged = name.trim() === saved.name && phone.trim() === saved.phone;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setNotice(null);

    const result = await sendJson('/api/account/profile', 'PATCH', { name, phone });
    setIsSaving(false);

    if (!result.ok) {
      setNotice({ kind: 'error', text: result.error });
      return;
    }

    const user = result.data.user as { name: string; phone: string };
    setName(user.name);
    setSaved({ name: user.name, phone: user.phone });
    // The navbar greets the customer by name, so let it pick up the new one.
    void refresh();

    if (result.data.verification) {
      setVerification(result.data.verification as PhoneVerificationInfo);
      return;
    }

    setPhone(user.phone);
    setNotice({ kind: 'success', text: 'Your details are saved.' });
  };

  const handleNumberConfirmed = (user: VerifiedUser) => {
    setPhone(user.phone ?? '');
    setSaved({ name: user.name, phone: user.phone ?? '' });
    setVerification(null);
    setNotice({ kind: 'success', text: 'Your new number is confirmed and saved.' });
  };

  const keepOldNumber = () => {
    setPhone(saved.phone);
    setVerification(null);
    setNotice(null);
  };

  if (verification) {
    return (
      <section aria-labelledby="profile-heading" className="rounded-2xl bg-surface p-6 shadow-soft">
        <h2 id="profile-heading" className="sr-only">
          Confirm your new number
        </h2>
        <WhatsAppCodeForm
          key={verification.ticket}
          compact
          verification={verification}
          title="Confirm your new number"
          verifyLabel="Confirm number"
          backLabel="Keep my old number"
          onBack={keepOldNumber}
          onVerified={handleNumberConfirmed}
        />
      </section>
    );
  }

  return (
    <section aria-labelledby="profile-heading" className="rounded-2xl bg-surface p-6 shadow-soft">
      <h2 id="profile-heading" className="mb-1 flex items-center gap-2 text-lg font-bold text-ink">
        <UserRound className="h-5 w-5 text-accent" />
        Your details
      </h2>
      <p className="mb-5 text-sm text-brand-gray">The name and number sellers and riders see on your orders.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="settings-name" className="mb-1.5 block text-sm font-semibold text-ink">
            Full name
          </label>
          <input
            id="settings-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
            autoComplete="name"
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="settings-phone" className="mb-1.5 block text-sm font-semibold text-ink">
            Phone number
          </label>
          <input
            id="settings-phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            maxLength={20}
            required
            autoComplete="tel"
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="settings-email" className="mb-1.5 block text-sm font-semibold text-ink">
            Email
          </label>
          <input id="settings-email" type="email" value={email} readOnly className={INPUT_CLASS} />
          <p className="mt-1 text-xs text-brand-gray">Your email is your login, so it can&apos;t be changed here.</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={isSaving || unchanged} className={BUTTON_CLASS}>
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
          <NoticeLine notice={notice} />
        </div>
      </form>
    </section>
  );
}

function SavedAddresses({ initialAddresses }: { initialAddresses: SettingsAddress[] }) {
  const [addresses, setAddresses] = useState(initialAddresses);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const remove = async (address: SettingsAddress) => {
    if (!window.confirm(`Remove your saved ${address.label} address?`)) return;

    setRemovingId(address.id);
    setError('');

    try {
      await deleteSavedAddress(address.id);
      setAddresses((prev) => prev.filter((item) => item.id !== address.id));
      announceSavedAddressRemoved(address.id);
    } catch {
      setError('Could not remove that address. Please try again.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <section aria-labelledby="addresses-heading" className="rounded-2xl bg-surface p-6 shadow-soft">
      <h2 id="addresses-heading" className="mb-1 flex items-center gap-2 text-lg font-bold text-ink">
        <MapPin className="h-5 w-5 text-accent" />
        Saved addresses
      </h2>
      <p className="mb-5 text-sm text-brand-gray">
        To add a new one, pick your location with the address button at the top of the page and choose Save.
      </p>

      {addresses.length === 0 ? (
        <p className="rounded-xl bg-brand-light px-4 py-3 text-sm text-brand-gray">You have no saved addresses yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {addresses.map((address) => {
            const Icon = ADDRESS_ICONS[getAddressTag(address.label)];

            return (
              <li key={address.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-red-primary/10 text-accent">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{address.label}</p>
                  <p className="truncate text-xs text-brand-gray" title={address.street}>
                    {address.street}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(address)}
                  disabled={removingId === address.id}
                  aria-label={`Remove saved ${address.label} address`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:border-red-600 hover:text-danger disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {removingId === address.id ? 'Removing…' : 'Remove'}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error ? (
        <p role="status" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}

/** Also used on the area manager's account page. */
export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);

    if (newPassword !== confirmPassword) {
      setNotice({ kind: 'error', text: 'The two new passwords do not match.' });
      return;
    }

    setIsSaving(true);
    const result = await sendJson('/api/account/password', 'POST', { currentPassword, newPassword });
    setIsSaving(false);

    if (!result.ok) {
      setNotice({ kind: 'error', text: result.error });
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setNotice({ kind: 'success', text: 'Your password has been changed.' });
  };

  return (
    <section aria-labelledby="password-heading" className="rounded-2xl bg-surface p-6 shadow-soft">
      <h2 id="password-heading" className="mb-1 flex items-center gap-2 text-lg font-bold text-ink">
        <KeyRound className="h-5 w-5 text-accent" />
        Change password
      </h2>
      <p className="mb-5 text-sm text-brand-gray">Use at least 8 characters.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="settings-current-password" className="mb-1.5 block text-sm font-semibold text-ink">
            Current password
          </label>
          <input
            id="settings-current-password"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
            autoComplete="current-password"
            className={INPUT_CLASS}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="settings-new-password" className="mb-1.5 block text-sm font-semibold text-ink">
              New password
            </label>
            <input
              id="settings-new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={6}
              required
              autoComplete="new-password"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="settings-confirm-password" className="mb-1.5 block text-sm font-semibold text-ink">
              Confirm new password
            </label>
            <input
              id="settings-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={6}
              required
              autoComplete="new-password"
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={isSaving} className={BUTTON_CLASS}>
            {isSaving ? 'Changing…' : 'Change password'}
          </button>
          <NoticeLine notice={notice} />
        </div>
      </form>
    </section>
  );
}

/** Customer Settings: edit name/phone, remove saved addresses, and change the password. */
export default function AccountSettings({
  name,
  phone,
  email,
  addresses,
}: {
  name: string;
  phone: string;
  email: string;
  addresses: SettingsAddress[];
}) {
  return (
    <div className="space-y-6">
      <ProfileForm initialName={name} initialPhone={phone} email={email} />
      <SavedAddresses initialAddresses={addresses} />
      <PasswordForm />
    </div>
  );
}
