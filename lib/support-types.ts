// Admin <-> seller/rider messages (Admin > Messages). Client-safe: shared by the APIs and the screens.

export const SUPPORT_NAME = 'Mangwaoo Support';
export const MAX_SUPPORT_MESSAGE_LENGTH = 2000;

export type SupportMessageView = {
  id: string;
  /** true: written by the admin team ("Mangwaoo Support"); false: by the seller/rider */
  fromAdmin: boolean;
  body: string;
  createdAt: string;
};

/** One seller or rider the admin can write to. */
export type SupportThreadSummary = {
  id: string;
  userId: string;
  name: string;
  role: 'SELLER' | 'RIDER';
  businessName: string | null;
  lastMessage: string | null;
  lastFromAdmin: boolean | null;
  updatedAt: string;
  /** Messages from the seller/rider that no admin has opened yet */
  unreadCount: number;
};

/** A seller or rider found by the admin's search, who may or may not have a thread yet. */
export type SupportPerson = {
  userId: string;
  name: string;
  role: 'SELLER' | 'RIDER';
  businessName: string | null;
  email: string;
};

/** A customer-seller chat as the admin sees it. */
export type AdminConversationSummary = {
  id: string;
  customerName: string;
  sellerName: string;
  productName: string | null;
  lastMessage: string | null;
  lastSenderRole: 'CUSTOMER' | 'SELLER' | 'ADMIN' | null;
  updatedAt: string;
};
