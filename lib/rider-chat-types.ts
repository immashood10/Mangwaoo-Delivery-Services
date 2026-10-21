// Client-safe shapes and limits shared by the rider chat API routes and UI
// (see serializeRiderChat / serializeRiderChatMessage in lib/rider-chat.ts).

export type RiderChatStatus = 'OPEN' | 'ACTIVE' | 'CLOSED';
export type RiderChatSender = 'CUSTOMER' | 'RIDER' | 'ADMIN';
export type RiderChatMessageType = 'TEXT' | 'IMAGE' | 'VOICE' | 'LOCATION';

export type RiderChatSummary = {
  id: string;
  status: RiderChatStatus;
  /** Drop-off (delivery) address and coordinates. */
  addressText: string;
  lat: number;
  lng: number;
  /** Pickup address and coordinates; null on chats created before pickup was asked. */
  pickupText: string | null;
  pickupLat: number | null;
  pickupLng: number | null;
  customerName: string;
  riderName: string | null;
  createdAt: string;
  updatedAt: string;
  nearbyRiderCount?: number;
  distanceKm?: number;
  lastMessage?: string | null;
  lastMessageFrom?: RiderChatSender | null;
};

export type RiderChatMessage = {
  id: string;
  type: RiderChatMessageType;
  senderRole: RiderChatSender;
  senderName: string;
  body: string;
  createdAt: string;
  lat: number | null;
  lng: number | null;
  durationSec: number | null;
  /** Same-origin URL for IMAGE / VOICE bytes (auth-checked by the API). */
  attachmentUrl: string | null;
};

export const MAX_RIDER_CHAT_MESSAGE_LENGTH = 2000;
export const MAX_CHAT_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_CHAT_VOICE_BYTES = 3 * 1024 * 1024;
export const MAX_CHAT_VOICE_SECONDS = 120;

export const ALLOWED_CHAT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_CHAT_VOICE_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/x-m4a'];

/** One-line preview for chat lists. */
export function riderChatMessagePreview(message: { type: RiderChatMessageType; body: string }) {
  switch (message.type) {
    case 'IMAGE':
      return message.body ? `📷 ${message.body}` : '📷 Photo';
    case 'VOICE':
      return '🎤 Voice message';
    case 'LOCATION':
      return '📍 Location';
    default:
      return message.body;
  }
}
