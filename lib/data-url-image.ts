// Photos are stored in the database as data URLs. Grids of cards load each picture from an image route
// instead of carrying every photo inside the page, and the browser caches it.

// Raster formats only: an SVG served from our own origin could run scripts if someone opened it directly.
const SERVABLE = /^data:(image\/(?:jpeg|jpg|png|webp|gif|avif));base64,([A-Za-z0-9+/=\s]+)$/;

/** A stored data-URL photo as a cacheable image response; 404 when there is none or it isn't a raster image. */
export function dataUrlImageResponse(dataUrl: string | null | undefined) {
  const match = dataUrl?.match(SERVABLE);

  if (!match) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(Buffer.from(match[2], 'base64'), {
    headers: {
      'Content-Type': match[1],
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}
