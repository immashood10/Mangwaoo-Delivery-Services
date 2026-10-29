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
  /** The delivery charge of this order in whole PKR, worked out by the server (0 = none): what the rider's commission is a percentage of. */
  deliveryCharge: number;
  customerName: string;
  riderName: string | null;
  /** The order is with the Area Sales Manager of `areaName`, who picks the rider (absent / false: the first rider to reply takes it). */
  managed?: boolean;
  areaName?: string | null;
  createdAt: string;
  updatedAt: string;
  /** How customers rate this order's rider (null: nobody has rated them yet). Set where the customer meets the rider. */
  riderRating?: { average: number; count: number } | null;
  /** After the order was delivered: the stars the customer gave for it (null: not rated yet). */
  myStars?: number | null;
  /** After the order was delivered: the customer may still rate the rider for it. */
  canRate?: boolean;
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
/** What a shared location says when it has no address of its own ("my location"); a place picked on the map carries its address instead. */
export const SHARED_LOCATION_BODY = 'Shared a location';
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
      return message.body && message.body !== SHARED_LOCATION_BODY ? `📍 ${message.body}` : '📍 Location';
    default:
      return message.body;
  }
}
