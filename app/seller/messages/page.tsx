import { MessageSquare } from 'lucide-react';
import MessagesInbox from '@/components/MessagesInbox';
import SupportChat from '@/components/SupportChat';
import SellerPageHeader from '@/components/seller/SellerPageHeader';

export default function SellerMessagesPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <SellerPageHeader
        icon={MessageSquare}
        title="Messages"
        description="Chats from customers who wrote to you from a product page."
      />

      <SupportChat />
      <MessagesInbox currentRole="SELLER" />
    </div>
  );
}
