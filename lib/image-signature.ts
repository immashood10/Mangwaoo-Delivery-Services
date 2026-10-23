// Which kind of picture an uploaded file really is, judged from its first bytes: never from the file name or from the
// type the browser claims, which anybody can fake. Only raster formats are accepted (an SVG served from our own address
// could run script if someone opened it directly).

export type RasterImageType = 'image/jpeg' | 'image/png' | 'image/webp';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function asciiAt(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

/** "image/jpeg", "image/png" or "image/webp" when the bytes are one of those pictures, otherwise null. */
export function detectRasterImage(bytes: Uint8Array): RasterImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';

  if (bytes.length >= PNG_SIGNATURE.length && PNG_SIGNATURE.every((value, index) => bytes[index] === value)) return 'image/png';

  if (bytes.length >= 12 && asciiAt(bytes, 0, 4) === 'RIFF' && asciiAt(bytes, 8, 4) === 'WEBP') return 'image/webp';

  return null;
}
