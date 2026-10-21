// Browser-only image helpers (canvas based). Import from client components only.

const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_QUALITY = 0.82;

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not prepare this photo.'))), 'image/jpeg', quality)
  );
}

/** Downscales and re-encodes a photo as JPEG so uploads stay small and fast. */
export async function compressImage(
  file: Blob,
  { maxDimension = DEFAULT_MAX_DIMENSION, quality = DEFAULT_QUALITY } = {}
): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error('Could not read this photo. Please try a JPG or PNG image.');

  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return canvasToJpeg(canvas, quality);
}

/**
 * Captures the part of a playing <video> that sits under `frame` on screen
 * (accounting for `object-fit: cover` cropping) and returns it as a JPEG.
 */
export async function captureVideoRegion(
  video: HTMLVideoElement,
  frame: HTMLElement,
  { maxDimension = DEFAULT_MAX_DIMENSION, quality = DEFAULT_QUALITY } = {}
): Promise<Blob> {
  const videoRect = video.getBoundingClientRect();
  const frameRect = frame.getBoundingClientRect();
  const { videoWidth, videoHeight } = video;
  if (!videoWidth || !videoHeight) throw new Error('The camera is not ready yet.');

  // object-fit: cover — the video is scaled up until it fills the element, then centred.
  const scale = Math.max(videoRect.width / videoWidth, videoRect.height / videoHeight);
  const offsetX = (videoRect.width - videoWidth * scale) / 2;
  const offsetY = (videoRect.height - videoHeight * scale) / 2;

  const sx = Math.max(0, (frameRect.left - videoRect.left - offsetX) / scale);
  const sy = Math.max(0, (frameRect.top - videoRect.top - offsetY) / scale);
  const sw = Math.min(videoWidth - sx, frameRect.width / scale);
  const sh = Math.min(videoHeight - sy, frameRect.height / scale);

  const outScale = Math.min(1, maxDimension / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * outScale);
  canvas.height = Math.round(sh * outScale);
  canvas.getContext('2d')?.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  return canvasToJpeg(canvas, quality);
}
