'use client';

import { useState, type FormEvent } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, MapPin, Plus, Trash2, UserCog } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { AREA_OPTIONS, MANAGER_LOGIN_MAX, MANAGER_NAME_MAX, type ManagerRow } from '@/lib/area-managers-config';

const INPUT_CLASS =
  'w-full rounded-xl border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-red-100 disabled:opacity-60';
const LABEL_CLASS = 'mb-1.5 block text-sm font-semibold text-ink';
const BUTTON_CLASS =
  'rounded-xl bg-gradient-to-r from-brand-red-primary to-brand-red-secondary px-5 py-2.5 text-sm font-semibold text-white hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60';
const SMALL_BUTTON_CLASS =
  'inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent disabled:opacity-60';

type SendResult = { ok: true; data: Record<string, unknown> | null } | { ok: false; error: string };

async function send(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<SendResult> {
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => null);

    return response.ok ? { ok: true, data } : { ok: false, error: (data?.error as string | undefined) ?? 'Something went wrong. Please try again.' };
  } catch {
    return { ok: false, error: 'Could not reach the server. Please try again.' };
  }
}

function ManagerCard({
  manager,
  onChanged,
  onRemoved,
}: {
  manager: ManagerRow;
  onChanged: (manager: ManagerRow, message: string) => void;
  onRemoved: (manager: ManagerRow) => void;
}) {
  const [mode, setMode] = useState<'idle' | 'area' | 'password'>('idle');
  const [areaId, setAreaId] = useState(manager.areaId);
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);

  const save = async (patch: { areaId?: number; password?: string }, message: string) => {
    setIsSaving(true);
    setError('');

    const result = await send(`/api/admin/area-managers/${manager.id}`, 'PATCH', patch);

    setIsSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMode('idle');
    setPassword('');
    onChanged((result.data?.manager as ManagerRow | undefined) ?? manager, message);
  };

  return (
    <li className="rounded-2xl border border-gray-100 bg-surface p-5 shadow-soft" data-manager-id={manager.id} data-manager-login={manager.login}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-bold text-ink">
            <UserCog className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            <span className="truncate">{manager.name}</span>
          </p>
          <p className="mt-1 text-sm text-brand-gray">
            Login: <span className="font-semibold text-ink">{manager.login}</span>
            {manager.phone ? ` · ${manager.phone}` : ''}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-ink">
            <MapPin className="h-4 w-4 text-accent" aria-hidden="true" />
            {manager.areaName}
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold text-ink">
            {manager.openChats} running {manager.openChats === 1 ? 'order' : 'orders'}
          </p>
          <p className={manager.waitingChats > 0 ? 'text-warning' : 'text-brand-gray'}>{manager.waitingChats} waiting for a rider</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={SMALL_BUTTON_CLASS} onClick={() => setMode(mode === 'area' ? 'idle' : 'area')}>
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          Change area
        </button>
        <button type="button" className={SMALL_BUTTON_CLASS} onClick={() => setMode(mode === 'password' ? 'idle' : 'password')}>
          <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
          New password
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-red-50"
          onClick={() => setIsRemoving(true)}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Remove
        </button>
      </div>

      {mode === 'area' ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save({ areaId }, `${manager.name} now looks after ${AREA_OPTIONS.find((area) => area.id === areaId)?.name}.`);
          }}
          className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-brand-light p-4"
        >
          <div className="min-w-48 flex-1">
            <label htmlFor={`area-${manager.id}`} className={LABEL_CLASS}>
              Area
            </label>
            <select id={`area-${manager.id}`} value={areaId} onChange={(event) => setAreaId(Number(event.target.value))} className={INPUT_CLASS}>
              {AREA_OPTIONS.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={isSaving || areaId === manager.areaId} className={BUTTON_CLASS}>
            {isSaving ? 'Saving…' : 'Save area'}
          </button>
        </form>
      ) : null}

      {mode === 'password' ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save({ password }, `${manager.name}'s password was changed. Their old logins have ended.`);
          }}
          className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-brand-light p-4"
        >
          <div className="min-w-48 flex-1">
            <label htmlFor={`password-${manager.id}`} className={LABEL_CLASS}>
              New password
            </label>
            <div className="relative">
              <input
                id={`password-${manager.id}`}
                type={isPasswordVisible ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                className={`${INPUT_CLASS} pr-11`}
              />
              <button
                type="button"
                onClick={() => setIsPasswordVisible((visible) => !visible)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-gray hover:text-accent"
                aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
              >
                {isPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={isSaving || password.length < 8} className={BUTTON_CLASS}>
            {isSaving ? 'Saving…' : 'Save password'}
          </button>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {isRemoving ? (
        <ConfirmDialog
          title="Remove this manager?"
          message={`Remove ${manager.name}? They are logged out at once and can never log in again.`}
          note={
            manager.openChats > 0
              ? 'If they are the last manager of this area, its running orders go back to the riders (the first to reply takes them).'
              : 'The area keeps working: its orders go to the first rider who replies until a new manager is made.'
          }
          confirmLabel="Remove"
          onConfirm={async () => {
            const result = await send(`/api/admin/area-managers/${manager.id}`, 'DELETE');

            if (!result.ok) return result.error;

            setIsRemoving(false);
            onRemoved(manager);

            return null;
          }}
          onCancel={() => setIsRemoving(false)}
        />
      ) : null}
    </li>
  );
}

/**
 * Area Sales Managers, for the super admin: which areas have one, make a new one (login name + password given to the person),
 * move one to another area, set a new password, remove one. Orders customers start with the Chat button go to the manager of
 * their area, who picks the rider; an area without a manager works the old way (the first rider to reply takes the order).
 */
export default function AdminAreaManagers({ initialManagers }: { initialManagers: ManagerRow[] }) {
  const [managers, setManagers] = useState(initialManagers);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ name: '', login: '', phone: '', password: '', areaId: AREA_OPTIONS[0].id });
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const setField = (key: keyof typeof form, value: string | number) => setForm((current) => ({ ...current, [key]: value }));

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setIsCreating(true);
    setError('');
    setNotice('');

    const result = await send('/api/admin/area-managers', 'POST', {
      name: form.name,
      login: form.login,
      phone: form.phone,
      password: form.password,
      areaId: form.areaId,
    });

    setIsCreating(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    const created = result.data?.manager as ManagerRow | undefined;

    if (created) setManagers((current) => [...current, created].sort((a, b) => a.areaId - b.areaId || a.createdAt.localeCompare(b.createdAt)));
    setForm((current) => ({ ...current, name: '', login: '', phone: '', password: '' }));
    setNotice(`${created?.name ?? 'The manager'} can log in now at the normal Log in page with the login name and password you gave.`);
  };

  return (
    <div className="space-y-8">
      {notice ? (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {notice}
        </p>
      ) : null}

      <section aria-labelledby="areas-heading">
        <h2 id="areas-heading" className="mb-3 text-lg font-bold text-ink">
          Areas
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AREA_OPTIONS.map((area) => {
            const mine = managers.filter((manager) => manager.areaId === area.id);

            return (
              <li key={area.id} className="rounded-2xl bg-surface p-4 shadow-soft" data-area-id={area.id}>
                <p className="flex items-center gap-2 font-bold text-ink">
                  <MapPin className="h-4 w-4 text-accent" aria-hidden="true" />
                  {area.name}
                </p>
                {mine.length > 0 ? (
                  <p className="mt-1 text-sm text-success">{mine.map((manager) => manager.name).join(', ')}</p>
                ) : (
                  <p className="mt-1 text-sm text-warning">No manager: chat orders here go to the first rider who replies</p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="new-manager-heading" className="rounded-2xl bg-surface p-6 shadow-soft">
        <h2 id="new-manager-heading" className="mb-1 flex items-center gap-2 text-lg font-bold text-ink">
          <Plus className="h-5 w-5 text-accent" aria-hidden="true" />
          Make an Area Sales Manager
        </h2>
        <p className="mb-5 text-sm text-brand-gray">
          Give the person the login name and the password. They log in on the normal Log in page and land on their own screen. Several
          managers can share an area.
        </p>

        <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2" data-testid="new-manager-form">
          <div>
            <label htmlFor="manager-name" className={LABEL_CLASS}>
              Name
            </label>
            <input
              id="manager-name"
              value={form.name}
              onChange={(event) => setField('name', event.target.value)}
              maxLength={MANAGER_NAME_MAX}
              required
              autoComplete="off"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="manager-area" className={LABEL_CLASS}>
              Area
            </label>
            <select id="manager-area" value={form.areaId} onChange={(event) => setField('areaId', Number(event.target.value))} className={INPUT_CLASS}>
              {AREA_OPTIONS.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="manager-login" className={LABEL_CLASS}>
              Login name
            </label>
            <input
              id="manager-login"
              value={form.login}
              onChange={(event) => setField('login', event.target.value)}
              maxLength={MANAGER_LOGIN_MAX}
              required
              autoComplete="off"
              placeholder="e.g. asm.gulshan"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="manager-phone" className={LABEL_CLASS}>
              Phone <span className="font-normal text-brand-gray">(optional)</span>
            </label>
            <input
              id="manager-phone"
              value={form.phone}
              onChange={(event) => setField('phone', event.target.value)}
              inputMode="tel"
              autoComplete="off"
              placeholder="0300 1234567"
              className={INPUT_CLASS}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="manager-password" className={LABEL_CLASS}>
              Password
            </label>
            <div className="relative">
              <input
                id="manager-password"
                type={isPasswordVisible ? 'text' : 'password'}
                value={form.password}
                onChange={(event) => setField('password', event.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
                className={`${INPUT_CLASS} pr-11`}
              />
              <button
                type="button"
                onClick={() => setIsPasswordVisible((visible) => !visible)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-gray hover:text-accent"
                aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
              >
                {isPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-brand-gray">At least 8 characters. The manager can change it later on their account page.</p>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-danger sm:col-span-2">
              {error}
            </p>
          ) : null}

          <div className="sm:col-span-2">
            <button type="submit" disabled={isCreating} className={BUTTON_CLASS}>
              {isCreating ? 'Making…' : 'Make manager'}
            </button>
          </div>
        </form>
      </section>

      <section aria-labelledby="managers-heading">
        <h2 id="managers-heading" className="mb-3 text-lg font-bold text-ink">
          Managers ({managers.length})
        </h2>
        {managers.length === 0 ? (
          <p className="rounded-2xl bg-surface p-6 text-sm text-brand-gray shadow-soft">
            No managers yet. Until you make one, every chat order goes to the first rider who replies.
          </p>
        ) : (
          <ul className="space-y-3">
            {managers.map((manager) => (
              <ManagerCard
                key={manager.id}
                manager={manager}
                onChanged={(updated, message) => {
                  setManagers((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)).sort((a, b) => a.areaId - b.areaId || a.createdAt.localeCompare(b.createdAt)));
                  setNotice(message);
                }}
                onRemoved={(removed) => {
                  setManagers((current) => current.filter((entry) => entry.id !== removed.id));
                  setNotice(`${removed.name} was removed.`);
                }}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
