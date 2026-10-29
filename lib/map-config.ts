// Where the live tracking map gets its picture. Client-safe.
//
// The default is OpenStreetMap's public tile server: free, with a required credit line (shown on the map) and a usage policy
// meant for modest traffic. If the site outgrows it, point NEXT_PUBLIC_MAP_TILE_URL at a paid provider's raster tiles, e.g.
// https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=...  (placeholders {z} {x} {y}; no {s} subdomains).
// next.config.ts reads the same variable to allow that address in the Content-Security-Policy (img-src): keep them in step.

export const MAP_TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const MAP_ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '© OpenStreetMap contributors';
export const MAP_ATTRIBUTION_URL = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION_URL || 'https://www.openstreetmap.org/copyright';
