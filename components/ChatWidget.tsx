'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import ChatThread from './ChatThread';

export default function ChatWidget({
  sellerId,
  sellerName,
  productName,
  className,
}: {
  sellerId: string;
  sellerName: string;
  productName?: string;
  className?: string;
}) {
  const { user, isLoading, openSignIn } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState('');

  if (!isLoading && user && user.role !== 'CUSTOMER') {
    return null;
  }

  const handleOpen = async () => {
    if (isLoading) return;
    if (!user) {
      openSignIn();
      return;
    }

    setIsOpen(true);

    if (conversationId) return;

    setIsStarting(true);
    setStartError('');

    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId, productName }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStartError(data?.error ?? 'Could not start the conversation.');
        return;
      }

      setConversationId(data.conversation.id);
    } catch {
      setStartError('Could not reach the server.');
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={
          className ??
          'inline-flex items-center justify-center gap-2 rounded-xl border-2 border-brand-red-primary px-8 py-3 text-sm font-semibold text-brand-red-primary hover:bg-brand-red-primary hover:text-white transition-all duration-300'
        }
      >
        <MessageSquare className="w-4 h-4" />
        Chat with Seller
      </button>

      {isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4 sm:items-center">
            <div className="flex h-[32rem] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-100 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-brand-dark">{sellerName}</p>
                  {productName ? <p className="truncate text-xs text-brand-gray">About: {productName}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="shrink-0 rounded-full border border-gray-200 p-2 text-brand-dark hover:bg-gray-100"
                  aria-label="Close chat"
                >
                  <X size={16} />
                </button>
              </div>

              {isStarting ? (
                <div className="flex flex-1 items-center justify-center">
                  <p className="text-sm text-brand-gray">Starting conversation…</p>
                </div>
              ) : startError ? (
                <div className="flex flex-1 items-center justify-center p-4">
                  <p className="text-sm text-red-600">{startError}</p>
                </div>
              ) : conversationId ? (
                <ChatThread conversationId={conversationId} currentRole="CUSTOMER" />
              ) : null}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
