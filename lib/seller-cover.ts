import { detectRasterImage } from '@/lib/image-signature';
import { MAX_COVER_BYTES } from '@/lib/seller-cover-config';

// Server-side checks for the picture a food seller sends as their restaurant's background. See seller-cover-config.ts.

const DATA_URL = /^data:image\/[a-z+.-]+;base64,([A-Za-z0-9+/]+={0,2})$/;
// base64 is 4 characters per 3 bytes; the "data:image/…;base64," prefix is short.
const MAX_DATA_URL_LENGTH = Math.ceil((MAX_COVER_BYTES * 4) / 3) + 64;

export type CoverUpload = { mimeType: string; size: number; data: Uint8Array<ArrayBuffer> };

/**
 * Reads the background picture a seller sent as a data URL.
 *
 * - `undefined` — nothing was sent (keep what is there);
 * - `null` — an empty value: no picture (remove it);
 * - `'invalid'` — not a real JPEG, PNG or WebP picture, or too big;
 * - otherwise the picture's bytes. Its type is read from the bytes themselves, never from what the sender claims,
 *   so nothing that could run script (an SVG, HTML) is ever stored.
 */
export function parseCoverUpload(value: unknown): CoverUpload | 'invalid' | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > MAX_DATA_URL_LENGTH) return 'invalid';

  const match = value.match(DATA_URL);

  if (!match) return 'invalid';

  const data = new Uint8Array(Buffer.from(match[1], 'base64'));
  const mimeType = detectRasterImage(data);

  if (!mimeType || data.length > MAX_COVER_BYTES) return 'invalid';

  return { mimeType, size: data.length, data };
}

/**
 * A stored background picture as an image response. A versioned address (`?v=<when it was set>`) changes with every
 * new picture, so it may be kept for good; `shared` pictures (public pages) may sit in shared caches too.
 */
export function coverResponse(
  cover: { mimeType: string; size: number; data: Uint8Array },
  { versioned, shared }: { versioned: boolean; shared: boolean }
) {
  const lifetime = versioned ? 'max-age=31536000, immutable' : 'max-age=300, stale-while-revalidate=3600';

  return new Response(Buffer.from(cover.data), {
    headers: {
      'Content-Type': cover.mimeType,
      'Content-Length': String(cover.size),
      'Cache-Control': `${shared ? 'public' : 'private'}, ${lifetime}`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}

/** Whether the address carries a version number (`?v=…`). */
export function isVersioned(searchParams: URLSearchParams) {
  return /^\d{1,16}$/.test(searchParams.get('v') ?? '');
}
