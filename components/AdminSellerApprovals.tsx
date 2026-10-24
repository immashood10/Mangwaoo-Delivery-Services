'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';

type SellerRow = {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  sellerType: string;
  isApproved: boolean;
  /** The kitchen is pinned on the map. Without it the restaurant isn't shown to customers (food is listed within 5 km). */
  hasLocation: boolean;
  createdAt: string;
};

const SELLER_TYPE_LABELS: Record<string, string> = {
  MART: 'MangwaooMart',
  GULPLAZA_OWNER: 'Food Business Owner',
  WHOLESALER: 'Food Business Owner',
};

export default function AdminSellerApprovals({ sellers }: { sellers: SellerRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const setApproval = async (sellerId: string, isApproved: boolean) => {
    setError('');
    setPendingId(sellerId);

    try {
      const response = await fetch(`/api/admin/sellers/${sellerId}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isApproved }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? 'Could not update this seller. Please try again.');
        return;
      }

      router.refresh();
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setPendingId(null);
    }
  };

  if (sellers.length === 0) {
    return (
      <p className="text-brand-gray text-sm">
        No food business seller applications yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-brand-gray border-b border-gray-100">
              <th className="py-2 pr-4 font-semibold">Business</th>
              <th className="py-2 pr-4 font-semibold">Owner</th>
              <th className="py-2 pr-4 font-semibold">Type</th>
              <th className="py-2 pr-4 font-semibold">Status</th>
              <th className="py-2 pr-4 font-semibold">Applied</th>
              <th className="py-2 pr-4 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {sellers.map((seller) => (
              <tr key={seller.id} className="border-b border-gray-50 last:border-0">
                <td className="py-3 pr-4 font-semibold text-ink">
                  {seller.businessName}
                  {seller.hasLocation ? null : (
                    <span
                      title="Customers only see restaurants within 5 km of them, which needs the kitchen on the map. The seller sets it in Settings."
                      className="mt-1 block text-xs font-semibold text-warning"
                    >
                      No map location · hidden from customers
                    </span>
                  )}
                </td>
                <td className="py-3 pr-4 text-brand-gray">
                  {seller.ownerName}
                  <br />
                  <span className="text-xs">{seller.email}</span>
                </td>
                <td className="py-3 pr-4 text-brand-gray">
                  {SELLER_TYPE_LABELS[seller.sellerType] ?? seller.sellerType}
                </td>
                <td className="py-3 pr-4">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                      seller.isApproved ? 'bg-green-50 text-success' : 'bg-yellow-50 text-warning'
                    }`}
                  >
                    {seller.isApproved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                    {seller.isApproved ? 'Approved' : 'Pending'}
                  </span>
                </td>
                <td className="py-3 pr-4 text-brand-gray">
                  {new Date(seller.createdAt).toLocaleDateString('en-PK', { dateStyle: 'medium' })}
                </td>
                <td className="py-3 pr-4">
                  {seller.isApproved ? (
                    <button
                      type="button"
                      disabled={pendingId === seller.id}
                      onClick={() => setApproval(seller.id, false)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-ink hover:border-red-400 hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Revoke
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={pendingId === seller.id}
                      onClick={() => setApproval(seller.id, true)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand-red-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-red-secondary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {pendingId === seller.id ? 'Approving…' : 'Approve'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
