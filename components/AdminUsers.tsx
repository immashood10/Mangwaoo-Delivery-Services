'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Ban, Bell, Bike, CheckCircle2, Mail, MapPin, MessageSquare, Phone, ShieldOff, Store, Trash2, User as UserIcon, X } from 'lucide-react';
import {
  BAN_PRESETS,
  BAN_UNITS,
  MAX_BAN_AMOUNT,
  MAX_BAN_REASON_LENGTH,
  banHeadline,
  formatKarachiDate,
  formatKarachiDateTime,
  parseBanInput,
  unitName,
  type BanUnit,
} from '@/lib/ban-duration';
import type { AdminUserRow } from '@/lib/admin-user-types';
import { ADMIN_MESSAGE_TITLE, MAX_ADMIN_MESSAGE_LENGTH } from '@/lib/notification-types';

const FIELD_CLASS =
  'rounded-xl border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-red-100 disabled:opacity-50';
const INPUT_CLASS = `w-full ${FIELD_CLASS}`;
const LABEL_CLASS = 'mb-1.5 block text-sm font-semibold text-ink';

const ROLE_LABELS: Record<AdminUserRow['role'], string> = { CUSTOMER: 'Customer', SELLER: 'Seller', RIDER: 'Rider' };
const ROLE_ICONS = { CUSTOMER: UserIcon, SELLER: Store, RIDER: Bike } as const;

async function send(url: string, method: 'POST' | 'DELETE', body?: unknown) {
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => null);

    return response.ok ? { ok: true as const, data } : { ok: false as const, error: (data?.error as string | undefined) ?? 'Something went wrong. Please try again.' };
  } catch {
    return { ok: false as const, error: 'Could not reach the server. Please try again.' };
  }
}

function Modal({ titleId, onClose, children }: { titleId: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKey);

    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface p-6 shadow-2xl sm:rounded-2xl"
      >
        {children}
      </div>
    </div>
  );
}

/** The ban form: quick choices that fill in the fields, and the fields themselves, which the admin can write freely. */
function BanDialog({ user, onClose, onDone }: { user: AdminUserRow; onClose: () => void; onDone: (message: string) => void }) {
  const [permanent, setPermanent] = useState(false);
  const [amount, setAmount] = useState('1');
  const [unit, setUnit] = useState<BanUnit>('day');
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    amountRef.current?.focus();
    amountRef.current?.select();
  }, []);

  // What the person will be told, worked out by the same code the server uses.
  const parsed = useMemo(() => parseBanInput({ permanent, amount: Number(amount), unit, reason }), [permanent, amount, unit, reason]);
  const length = parsed.ok ? (parsed.input.permanent ? 'permanently' : parsed.input.durationLabel) : null;

  const choosePreset = (presetAmount: number, presetUnit: BanUnit) => {
    setPermanent(false);
    setAmount(String(presetAmount));
    setUnit(presetUnit);
    setError('');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    setIsSaving(true);
    setError('');

    const result = await send(`/api/admin/users/${user.id}/ban`, 'POST', { permanent, amount: Number(amount), unit, reason });

    setIsSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onDone(`${user.name} is banned ${length === 'permanently' ? 'permanently' : `for ${length}`}. They have been logged out.`);
  };

  return (
    <Modal titleId="ban-dialog-title" onClose={onClose}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 id="ban-dialog-title" className="flex items-center gap-2 text-lg font-bold text-ink">
            <Ban className="h-5 w-5 text-danger" />
            {user.ban ? 'Change the ban' : 'Ban'} · {user.name}
          </h2>
          <p className="mt-1 text-sm text-brand-gray">
            They are logged out within seconds and can&apos;t log in until the ban ends. They are told how long it is.
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-brand-gray hover:bg-gray-100 hover:text-ink" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      {user.ban ? (
        <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">
          Now banned {user.ban.permanent ? 'permanently' : `for ${user.ban.durationLabel} (until ${formatKarachiDateTime(new Date(user.ban.endsAt ?? user.ban.startedAt))})`}. A new ban replaces it.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset>
          <legend className={LABEL_CLASS}>Quick choice</legend>
          <div className="flex flex-wrap gap-2">
            {BAN_PRESETS.map((preset) => {
              const active = !permanent && amount === String(preset.amount) && unit === preset.unit;

              return (
                <button
                  key={preset.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => choosePreset(preset.amount, preset.unit)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active ? 'border-accent bg-red-50 text-accent' : 'border-gray-200 text-ink hover:border-accent'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
            <button
              type="button"
              aria-pressed={permanent}
              onClick={() => {
                setPermanent(true);
                setError('');
              }}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                permanent ? 'border-danger bg-red-50 text-danger' : 'border-gray-200 text-ink hover:border-danger'
              }`}
            >
              Permanent
            </button>
          </div>
        </fieldset>

        <div>
          <label htmlFor="ban-amount" className={LABEL_CLASS}>
            Or write how long yourself
          </label>
          <div className="flex gap-2">
            <input
              id="ban-amount"
              ref={amountRef}
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_BAN_AMOUNT}
              step={1}
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setPermanent(false);
              }}
              disabled={permanent}
              aria-label="Length of the ban"
              className={`w-28 shrink-0 ${FIELD_CLASS}`}
            />
            <select
              value={unit}
              onChange={(event) => setUnit(event.target.value as BanUnit)}
              disabled={permanent}
              aria-label="Unit of the ban"
              className={`min-w-0 flex-1 bg-surface ${FIELD_CLASS}`}
            >
              {BAN_UNITS.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {unitName(candidate, Number(amount) || 2)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="ban-reason" className={LABEL_CLASS}>
            Reason <span className="font-normal text-brand-gray">(optional, shown to them)</span>
          </label>
          <textarea
            id="ban-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={MAX_BAN_REASON_LENGTH}
            rows={2}
            placeholder="e.g. Fake orders"
            className={INPUT_CLASS}
          />
        </div>

        <div className="rounded-xl bg-brand-light px-4 py-3 text-sm" aria-live="polite">
          {parsed.ok ? (
            <>
              <p className="text-brand-gray">They will see:</p>
              <p className="font-semibold text-ink">{banHeadline({ permanent: parsed.input.permanent, durationLabel: length ?? '' })}.</p>
              <p className="mt-1 text-xs text-brand-gray">
                {parsed.input.permanent ? 'Until you lift the ban.' : `Ends ${formatKarachiDateTime(parsed.input.endsAt)} (Karachi time).`}
              </p>
            </>
          ) : (
            <p className="text-brand-gray">{parsed.error}</p>
          )}
        </div>

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="text-sm font-semibold text-brand-gray hover:text-ink">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || !parsed.ok}
            className="rounded-xl bg-danger px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {isSaving ? 'Banning…' : 'Ban account'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const DELETE_EFFECTS: Record<AdminUserRow['role'], string[]> = {
  CUSTOMER: ['Their open orders are cancelled; past orders stay in the sellers’ records.'],
  SELLER: ['Their store disappears: listings are hidden and ads end.', 'Their open orders are cancelled.'],
  RIDER: ['Chats they are handling go back to waiting for another rider.'],
};

/** The admin's note to one person: it reaches them as a notification from Mangwaoo. */
function NotifyDialog({ user, onClose, onDone }: { user: AdminUserRow; onClose: () => void; onDone: (message: string) => void }) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textRef.current?.focus();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!text.trim()) {
      setError('Please write a message.');
      return;
    }

    setIsSending(true);
    setError('');

    const result = await send(`/api/admin/users/${user.id}/message`, 'POST', { message: text });

    setIsSending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onDone(`Notification sent to ${user.name}.`);
  };

  return (
    <Modal titleId="notify-dialog-title" onClose={onClose}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 id="notify-dialog-title" className="flex items-center gap-2 text-lg font-bold text-ink">
            <Bell className="h-5 w-5 text-accent" />
            Send notification · {user.name}
          </h2>
          <p className="mt-1 text-sm text-brand-gray">
            {user.name.split(' ')[0]} sees it in their notification bell as &quot;{ADMIN_MESSAGE_TITLE}&quot; (and on their phone if they turned notifications on).
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-brand-gray hover:bg-gray-100 hover:text-ink" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="notify-text" className={LABEL_CLASS}>
            Message
          </label>
          <textarea
            id="notify-text"
            ref={textRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={MAX_ADMIN_MESSAGE_LENGTH}
            rows={5}
            placeholder="Write what you want them to know…"
            className={`${INPUT_CLASS} resize-y`}
          />
          <p className="mt-1 text-right text-xs text-brand-gray">
            {text.length}/{MAX_ADMIN_MESSAGE_LENGTH}
          </p>
        </div>

        {error ? (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSending || !text.trim()}
            className="rounded-xl bg-brand-red-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-secondary disabled:opacity-60"
          >
            {isSending ? 'Sending…' : 'Send notification'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteDialog({ user, onClose, onDone }: { user: AdminUserRow; onClose: () => void; onDone: (message: string) => void }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setIsDeleting(true);
    setError('');

    const result = await send(`/api/admin/users/${user.id}`, 'DELETE');

    setIsDeleting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    const cancelled = (result.data?.cancelledOrders as number | undefined) ?? 0;

    onDone(`Deleted ${user.name}${cancelled > 0 ? ` and cancelled ${cancelled} open ${cancelled === 1 ? 'order' : 'orders'}` : ''}.`);
  };

  return (
    <Modal titleId="delete-dialog-title" onClose={onClose}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 id="delete-dialog-title" className="flex items-center gap-2 text-lg font-bold text-ink">
          <Trash2 className="h-5 w-5 text-danger" />
          Delete {user.name}?
        </h2>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-brand-gray hover:bg-gray-100 hover:text-ink" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      <ul className="mb-4 list-disc space-y-1.5 pl-5 text-sm text-brand-gray">
        <li>They are logged out at once and can never log in again.</li>
        <li>Their personal details are erased. Their email and number can be used to sign up again.</li>
        {DELETE_EFFECTS[user.role].map((line) => (
          <li key={line}>{line}</li>
        ))}
        <li className="font-semibold text-danger">This cannot be undone. To keep the account and only stop them for a while, use Ban.</li>
      </ul>

      {error ? (
        <p role="alert" className="mb-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <button type="button" onClick={onClose} className="text-sm font-semibold text-brand-gray hover:text-ink">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="rounded-xl bg-danger px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {isDeleting ? 'Deleting…' : 'Delete account'}
        </button>
      </div>
    </Modal>
  );
}

function Badge({ tone, children }: { tone: 'neutral' | 'good' | 'warn' | 'bad'; children: ReactNode }) {
  const toneClass = {
    neutral: 'bg-brand-light text-brand-gray',
    good: 'bg-green-50 text-success',
    warn: 'bg-yellow-50 text-warning',
    bad: 'bg-red-50 text-danger',
  }[tone];

  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${toneClass}`}>{children}</span>;
}

function UserCard({
  user,
  isBusy,
  onBan,
  onNotify,
  onUnban,
  onDelete,
}: {
  user: AdminUserRow;
  isBusy: boolean;
  onNotify: () => void;
  onBan: () => void;
  onUnban: () => void;
  onDelete: () => void;
}) {
  const RoleIcon = ROLE_ICONS[user.role];

  return (
    <li className={`rounded-2xl border bg-surface p-5 shadow-soft ${user.ban ? 'border-red-200' : 'border-gray-100'}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-red-primary/10 text-accent">
            <RoleIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-bold text-ink">{user.name}</h3>
              <Badge tone="neutral">{ROLE_LABELS[user.role]}</Badge>
              {user.seller ? (
                <Badge tone={user.seller.isApproved ? 'good' : 'warn'}>{user.seller.isApproved ? 'Approved' : 'Pending approval'}</Badge>
              ) : null}
              {user.rider ? (
                <Badge tone={user.rider.isOnline ? 'good' : user.rider.isApproved ? 'neutral' : 'warn'}>
                  {user.rider.isOnline ? 'Online now' : user.rider.isApproved ? 'Approved' : 'Pending approval'}
                </Badge>
              ) : null}
              {user.ban ? (
                <Badge tone="bad">
                  {user.ban.permanent ? 'Banned permanently' : `Banned for ${user.ban.durationLabel}`}
                </Badge>
              ) : null}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-brand-gray">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{user.email}</span>
              </span>
              {user.phone ? (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  {user.phone}
                </span>
              ) : null}
            </div>

            <p className="mt-1 text-xs text-brand-gray">
              Joined {formatKarachiDate(new Date(user.createdAt))}
              {user.orderCount !== null ? ` · ${user.orderCount} ${user.orderCount === 1 ? 'order' : 'orders'}` : ''}
              {user.rider?.vehicleType ? ` · ${user.rider.vehicleType}` : ''}
            </p>
            {user.seller ? (
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-brand-gray">
                <Store className="h-3.5 w-3.5 shrink-0" />
                <span className="font-semibold text-ink">{user.seller.businessName}</span>
                <span>· {user.seller.isFood ? 'Food business' : 'MangwaooMart'}</span>
                {user.seller.city ? (
                  <span className="inline-flex items-center gap-0.5">
                    · <MapPin className="h-3 w-3" /> {user.seller.city}
                  </span>
                ) : null}
              </p>
            ) : null}
            {user.ban ? (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-danger">
                {user.ban.permanent ? 'Banned until you lift it.' : `Banned until ${formatKarachiDateTime(new Date(user.ban.endsAt ?? user.ban.startedAt))}.`}
                {user.ban.reason ? ` Reason: ${user.ban.reason}` : ''}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {user.role === 'RIDER' && user.rider && !user.rider.isApproved ? (
            <Link
              href="/admin/riders"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-red-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-red-secondary"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Review &amp; approve
            </Link>
          ) : null}
          {user.role === 'SELLER' || user.role === 'RIDER' ? (
            <Link
              href={`/admin/messages?user=${encodeURIComponent(user.id)}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Message
            </Link>
          ) : null}
          <button
            type="button"
            onClick={onNotify}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent"
          >
            <Bell className="h-3.5 w-3.5" />
            Send notification
          </button>
          <button
            type="button"
            onClick={onBan}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:border-red-600 hover:text-danger disabled:opacity-60"
          >
            <Ban className="h-3.5 w-3.5" />
            {user.ban ? 'Change ban' : 'Ban'}
          </button>
          {user.ban ? (
            <button
              type="button"
              onClick={onUnban}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent disabled:opacity-60"
            >
              <ShieldOff className="h-3.5 w-3.5" />
              {isBusy ? 'Lifting…' : 'Unban'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDelete}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-red-50 disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}

/** The list of accounts behind a dashboard card, with Ban / Unban / Delete on every row. */
export default function AdminUsers({ rows, emptyMessage }: { rows: AdminUserRow[]; emptyMessage: string }) {
  const router = useRouter();
  const [banTarget, setBanTarget] = useState<AdminUserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);
  const [notifyTarget, setNotifyTarget] = useState<AdminUserRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const finish = (message: string) => {
    setBanTarget(null);
    setDeleteTarget(null);
    setNotifyTarget(null);
    setError('');
    setNotice(message);
    router.refresh();
  };

  const unban = async (user: AdminUserRow) => {
    setBusyId(user.id);
    setNotice('');
    setError('');

    const result = await send(`/api/admin/users/${user.id}/ban`, 'DELETE');

    setBusyId(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    finish(`${user.name} is unbanned and can log in again.`);
  };

  return (
    <div>
      {notice ? (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 bg-surface p-10 text-center text-sm text-brand-gray">{emptyMessage}</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              isBusy={busyId === user.id}
              onNotify={() => {
                setNotice('');
                setNotifyTarget(user);
              }}
              onBan={() => {
                setNotice('');
                setBanTarget(user);
              }}
              onUnban={() => unban(user)}
              onDelete={() => {
                setNotice('');
                setDeleteTarget(user);
              }}
            />
          ))}
        </ul>
      )}

      {banTarget ? <BanDialog key={banTarget.id} user={banTarget} onClose={() => setBanTarget(null)} onDone={finish} /> : null}
      {notifyTarget ? <NotifyDialog key={notifyTarget.id} user={notifyTarget} onClose={() => setNotifyTarget(null)} onDone={finish} /> : null}
      {deleteTarget ? <DeleteDialog key={deleteTarget.id} user={deleteTarget} onClose={() => setDeleteTarget(null)} onDone={finish} /> : null}
    </div>
  );
}

