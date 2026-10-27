import { detectRasterImage } from '@/lib/image-signature';
import {
  MAX_RIDER_DOCUMENT_BYTES,
  RIDER_DOCUMENT_MISSING_MESSAGES,
  RIDER_DOCUMENT_PHOTO_NAMES,
  type RiderDocumentKind,
} from '@/lib/rider-documents';

export type RiderPhoto = { kind: RiderDocumentKind; mimeType: string; size: number; data: Uint8Array<ArrayBuffer> };

/**
 * Reads one of a rider's photos (a CNIC side or the face) out of a form field. What kind of picture it is comes from its
 * first bytes, never from the file name or the type the browser says (those can be faked): only JPG, PNG and WebP are
 * kept, so nothing that could run as a page ever gets stored. Answers the photo, or what to tell the rider.
 */
export async function readRiderPhoto(
  kind: RiderDocumentKind,
  file: FormDataEntryValue | null
): Promise<{ ok: true; photo: RiderPhoto } | { ok: false; error: string }> {
  const name = RIDER_DOCUMENT_PHOTO_NAMES[kind];

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: RIDER_DOCUMENT_MISSING_MESSAGES[kind] };
  }

  if (file.size > MAX_RIDER_DOCUMENT_BYTES) {
    return { ok: false, error: `The ${name} is too large (max 3 MB).` };
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const mimeType = detectRasterImage(data);

  if (!mimeType) {
    return { ok: false, error: `The ${name} must be a JPG, PNG or WebP image.` };
  }

  return { ok: true, photo: { kind, mimeType, size: data.byteLength, data } };
}
