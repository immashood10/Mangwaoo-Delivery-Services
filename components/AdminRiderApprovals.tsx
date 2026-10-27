'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BadgeCheck, Bike, CheckCircle2, Clock, CreditCard, FileWarning, Mail, MessageSquare, Phone, ShieldOff, Users } from 'lucide-react';
import { RIDER_DOCUMENT_LABELS, type RiderDocumentKind } from '@/lib/rider-documents';

export type RiderApprovalRow = {
  /** Rider id (what the approve/documents APIs use) */
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  vehicleType: string | null;
  numberPlate: string | null;
  cnicNumber: string | null;
  isApproved: boolean;
  isOnline: boolean;
  createdAt: string;
  /** Which photos (the two sides of the CNIC, the face) are on file */
  documents: RiderDocumentKind[];
  /** What is still missing before the rider can be approved (empty when the application is complete) */
  missing: string[];
};

const DOCUMENT_ORDER: RiderDocumentKind[] = ['CNIC_FRONT', 'CNIC_BACK', 'FACE'];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' });
}

function RiderCard({ rider, isBusy, onSetApproval }: { rider: RiderApprovalRow; isBusy: boolean; onSetApproval: (approved: boolean) => void }) {
  const complete = rider.missing.length === 0;

  return (
    <li className={`rounded-2xl border bg-surface p-5 shadow-soft ${rider.isApproved ? 'border-gray-100' : 'border-yellow-200'}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-bold text-ink">{rider.name}</h3>
            {rider.isApproved ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {rider.isOnline ? 'Approved · online now' : 'Approved'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2.5 py-0.5 text-xs font-semibold text-warning">
                <Clock className="h-3.5 w-3.5" />
                Waiting for approval
              </span>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-brand-gray">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{rider.email}</span>
            </span>
            {rider.phone ? (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                {rider.phone}
              </span>
            ) : null}
          </div>

          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-brand-gray">
            <span className="inline-flex items-center gap-1">
              <Bike className="h-3.5 w-3.5" />
              {rider.vehicleType ?? 'Motorbike'}
              {rider.numberPlate ? ` · ${rider.numberPlate}` : ''}
            </span>
            <span className="inline-flex items-center gap-1">
              <CreditCard className="h-3.5 w-3.5" />
              CNIC {rider.cnicNumber ?? 'not given'}
            </span>
            <span>Applied {formatDate(rider.createdAt)}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/messages?user=${encodeURIComponent(rider.userId)}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Message
          </Link>
          {rider.isApproved ? (
            <button
              type="button"
              onClick={() => onSetApproval(false)}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-red-50 disabled:opacity-60"
            >
              <ShieldOff className="h-3.5 w-3.5" />
              {isBusy ? 'Updating…' : 'Take approval back'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSetApproval(true)}
              disabled={isBusy || !complete}
              title={complete ? undefined : `Missing: ${rider.missing.join(', ')}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-red-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-red-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <BadgeCheck className="h-3.5 w-3.5" />
              {isBusy ? 'Approving…' : 'Approve rider'}
            </button>
          )}
        </div>
      </div>

      {rider.missing.length > 0 ? (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-yellow-50 px-3 py-2 text-xs text-warning">
          <FileWarning className="h-4 w-4 shrink-0" />
          Missing: {rider.missing.join(', ')}. This rider can&apos;t be approved until these are on file.
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-xl sm:grid-cols-3">
        {DOCUMENT_ORDER.map((kind) => (
          <div key={kind}>
            <p className="mb-1 text-xs font-semibold text-ink">{RIDER_DOCUMENT_LABELS[kind]}</p>
            {rider.documents.includes(kind) ? (
              <a href={`/api/admin/riders/${rider.id}/documents/${kind}`} target="_blank" rel="noopener noreferrer" className="block">
                {/* Identity photos come from an admin-only route, so next/image's optimiser is not used. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/admin/riders/${rider.id}/documents/${kind}`}
                  alt={`${rider.name}: ${RIDER_DOCUMENT_LABELS[kind]}`}
                  loading="lazy"
                  className={`h-28 w-full rounded-lg border border-gray-200 bg-brand-light object-cover ${kind === 'FACE' ? 'object-top' : ''}`}
                />
              </a>
            ) : (
              <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-gray-300 text-xs text-brand-gray">
                Not uploaded
              </div>
            )}
          </div>
        ))}
      </div>
    </li>
  );
}

/** Rider applications: check the CNIC photos and plate, then approve (or take the approval back). */
export default function AdminRiderApprovals({ riders }: { riders: RiderApprovalRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const setApproval = async (riderId: string, isApproved: boolean) => {
    setError('');
    setBusyId(riderId);

    try {
      const response = await fetch(`/api/admin/riders/${riderId}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isApproved }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? 'Could not update this rider. Please try again.');
        return;
      }

      router.refresh();
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const waiting = riders.filter((rider) => !rider.isApproved);
  const approved = riders.filter((rider) => rider.isApproved);

  const section = (title: string, list: RiderApprovalRow[], emptyText: string) => (
    <section className="space-y-3" aria-label={title}>
      <h2 className="text-sm font-bold uppercase tracking-wide text-ink">
        {title} ({list.length})
      </h2>
      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 bg-surface p-6 text-center text-sm text-brand-gray">{emptyText}</p>
      ) : (
        <ul className="space-y-3">
          {list.map((rider) => (
            <RiderCard key={rider.id} rider={rider} isBusy={busyId === rider.id} onSetApproval={(value) => setApproval(rider.id, value)} />
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="space-y-8">
      {error ? <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-danger">{error}</p> : null}

      {section('Waiting for approval', waiting, 'No rider is waiting for approval.')}
      {section('Approved riders', approved, 'No rider has been approved yet.')}

      <p className="flex flex-wrap items-center gap-2 text-xs text-brand-gray">
        <Users className="h-4 w-4" />
        To ban or delete a rider, use{' '}
        <Link href="/admin/users?view=riders" className="font-semibold text-accent hover:underline">
          Users → Riders
        </Link>
        .
      </p>
    </div>
  );
}
