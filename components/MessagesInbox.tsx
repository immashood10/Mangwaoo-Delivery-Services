'use client';

import { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import ChatThread from './ChatThread';

type ConversationSummary = {
  id: string;
  counterpartName: string;
  productName: string | null;
  lastMessage: string | null;
  updatedAt: string;
  unreadCount: number;
};

const LIST_POLL_INTERVAL_MS = 8000;

export default function MessagesInbox({ currentRole }: { currentRole: 'CUSTOMER' | 'SELLER' }) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchConversations = async () => {
      try {
        const response = await fetch('/api/conversations');
        if (!response.ok || !isMounted) return;
        const data = await response.json();
        setConversations(data.conversations ?? []);
      } catch {
        // Skip a failed poll — it'll retry on the next interval.
      }
    };

    (async () => {
      await fetchConversations();
      if (isMounted) setIsLoading(false);
    })();

    const intervalId = window.setInterval(fetchConversations, LIST_POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  const emptyMessage =
    currentRole === 'SELLER'
      ? 'No messages yet. When a customer chats with you from a product page, it’ll show up here.'
      : 'No messages yet. Start a chat with a seller from any product page.';

  return (
    <div className="bg-surface rounded-2xl shadow-soft overflow-hidden">
      <div className="flex items-center gap-2 border-b border-gray-100 p-6">
        <MessageSquare className="w-5 h-5 text-accent" />
        <h2 className="text-lg font-bold text-ink">Messages</h2>
      </div>

      {isLoading ? (
        <p className="p-6 text-sm text-brand-gray">Loading conversations…</p>
      ) : conversations.length === 0 ? (
        <p className="p-6 text-sm text-brand-gray">{emptyMessage}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3">
          <div className="max-h-[28rem] overflow-y-auto border-b border-gray-100 md:border-b-0 md:border-r">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setSelectedId(conversation.id)}
                className={`block w-full border-b border-gray-50 p-4 text-left transition-colors last:border-0 hover:bg-brand-light ${
                  selectedId === conversation.id ? 'bg-brand-light' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-ink">{conversation.counterpartName}</p>
                  {conversation.unreadCount > 0 && (
                    <span className="shrink-0 rounded-full bg-brand-red-primary px-2 py-0.5 text-[10px] font-bold text-white">
                      {conversation.unreadCount}
                    </span>
                  )}
                </div>
                {conversation.productName && (
                  <p className="truncate text-xs text-accent">About: {conversation.productName}</p>
                )}
                <p className="mt-1 truncate text-xs text-brand-gray">
                  {conversation.lastMessage ?? 'No messages yet'}
                </p>
              </button>
            ))}
          </div>

          <div className="h-[28rem] md:col-span-2">
            {selected ? (
              <ChatThread key={selected.id} conversationId={selected.id} currentRole={currentRole} />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-brand-gray">Select a conversation to view messages.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
