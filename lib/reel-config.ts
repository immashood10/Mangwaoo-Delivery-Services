export const MAX_REEL_BYTES = 3 * 1024 * 1024;
export const MAX_REEL_SECONDS = 45;
export const REEL_CAPTION_LIMIT = 500;
export function detectReelVideo(bytes: Uint8Array): 'video/mp4' | 'video/webm' | null {
  if (bytes.length < 16) return null;
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'video/webm';
  if (String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp') return 'video/mp4';
  return null;
}
export function videoRange(header: string | null, size: number) {
  if (!header) return { start: 0, end: size - 1, partial: false };
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] ? (match[2] ? Math.min(size - 1, Number(match[2])) : size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return null;
  return { start, end, partial: true };
}
