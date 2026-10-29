// The arithmetic of a "slippy" map (Web Mercator, 256 px tiles) for the live tracking map, without a map library:
// where a latitude/longitude falls on the screen, which tiles cover the screen, and which zoom and centre fit a set of
// points. Client-safe and pure, so it can be tested without a browser.

export const TILE_SIZE = 256;
export const MIN_ZOOM = 3;
export const MAX_ZOOM = 17;

export type LatLng = { lat: number; lng: number };
/** A position in pixels on the whole-world map at one zoom level (the top-left of the world is 0, 0). */
export type WorldPoint = { x: number; y: number };
/** What the map box shows: the centre (in world pixels at `zoom`) and the box's size in pixels. */
export type MapView = { zoom: number; center: WorldPoint; width: number; height: number };
export type MapTile = { key: string; x: number; y: number; z: number; left: number; top: number };

// Web Mercator can't show the poles.
const MAX_LATITUDE = 85.0511287798;

export function project(point: LatLng, zoom: number): WorldPoint {
  const scale = TILE_SIZE * 2 ** zoom;
  const lat = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, point.lat));
  const sin = Math.sin((lat * Math.PI) / 180);

  return {
    x: ((point.lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

export function unproject(world: WorldPoint, zoom: number): LatLng {
  const scale = TILE_SIZE * 2 ** zoom;
  const n = Math.PI - (2 * Math.PI * world.y) / scale;

  return { lat: (180 / Math.PI) * Math.atan(Math.sinh(n)), lng: (world.x / scale) * 360 - 180 };
}

/** Where `point` falls inside the map box, in pixels from its top-left corner. */
export function viewPosition(view: MapView, point: LatLng): { x: number; y: number } {
  const world = project(point, view.zoom);

  return { x: world.x - (view.center.x - view.width / 2), y: world.y - (view.center.y - view.height / 2) };
}

/** Whether `point` is inside the box, at least `margin` pixels from every edge. */
export function isInsideView(view: MapView, point: LatLng, margin: number) {
  const { x, y } = viewPosition(view, point);

  return x >= margin && x <= view.width - margin && y >= margin && y <= view.height - margin;
}

/**
 * The closest zoom (and the centre) at which every point is inside a box of `width` x `height`, `padding` pixels from the
 * edges. One point is shown at `singleZoom`. null for no points or a box that has no size yet.
 */
export function fitView(points: LatLng[], size: { width: number; height: number }, padding: number, singleZoom = 15): MapView | null {
  if (points.length === 0 || size.width <= 0 || size.height <= 0) return null;

  const { width, height } = size;

  if (points.length === 1) {
    return { zoom: singleZoom, center: project(points[0], singleZoom), width, height };
  }

  for (let zoom = MAX_ZOOM; zoom >= MIN_ZOOM; zoom -= 1) {
    const world = points.map((point) => project(point, zoom));
    const minX = Math.min(...world.map((p) => p.x));
    const maxX = Math.max(...world.map((p) => p.x));
    const minY = Math.min(...world.map((p) => p.y));
    const maxY = Math.max(...world.map((p) => p.y));

    if (maxX - minX <= width - 2 * padding && maxY - minY <= height - 2 * padding) {
      return { zoom, center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }, width, height };
    }
  }

  const world = points.map((point) => project(point, MIN_ZOOM));
  const x = (Math.min(...world.map((p) => p.x)) + Math.max(...world.map((p) => p.x))) / 2;
  const y = (Math.min(...world.map((p) => p.y)) + Math.max(...world.map((p) => p.y))) / 2;

  return { zoom: MIN_ZOOM, center: { x, y }, width, height };
}

/** The tiles that cover the box, each with where its top-left corner goes inside the box. */
export function tilesForView(view: MapView): MapTile[] {
  const tilesPerSide = 2 ** view.zoom;
  const left = view.center.x - view.width / 2;
  const top = view.center.y - view.height / 2;
  const tiles: MapTile[] = [];

  for (let ty = Math.floor(top / TILE_SIZE); ty <= Math.floor((top + view.height) / TILE_SIZE); ty += 1) {
    if (ty < 0 || ty >= tilesPerSide) continue;

    for (let tx = Math.floor(left / TILE_SIZE); tx <= Math.floor((left + view.width) / TILE_SIZE); tx += 1) {
      // The world repeats sideways: a tile past the dateline is the same tile from the other end.
      const wrapped = ((tx % tilesPerSide) + tilesPerSide) % tilesPerSide;

      tiles.push({ key: `${view.zoom}/${wrapped}/${ty}@${tx}`, x: wrapped, y: ty, z: view.zoom, left: tx * TILE_SIZE - left, top: ty * TILE_SIZE - top });
    }
  }

  return tiles;
}

/** A tile provider's address with {z} {x} {y} filled in. */
export function tileUrl(template: string, tile: Pick<MapTile, 'x' | 'y' | 'z'>) {
  return template.replace('{z}', String(tile.z)).replace('{x}', String(tile.x)).replace('{y}', String(tile.y));
}

// ── A map the visitor can move (the "choose on map" picker) ──

/** How far the picker lets the visitor zoom: the whole city out to a single building. */
export const PICKER_MIN_ZOOM = 3;
export const PICKER_MAX_ZOOM = 18;

export function clampZoom(zoom: number) {
  return Math.max(PICKER_MIN_ZOOM, Math.min(PICKER_MAX_ZOOM, Math.round(zoom)));
}

/** A longitude brought back into -180 .. 180 (the world repeats sideways) and a latitude kept where the map can show it. */
export function normalizeLatLng(point: LatLng): LatLng {
  const lng = ((((point.lng + 180) % 360) + 360) % 360) - 180;

  return { lat: Math.max(-MAX_LATITUDE + 0.01, Math.min(MAX_LATITUDE - 0.01, point.lat)), lng };
}

/**
 * The centre of the map after it is dragged by (dx, dy) pixels. The map follows the finger, so the centre goes the other way:
 * dragging right shows what was to the left.
 */
export function panCenter(center: LatLng, zoom: number, dx: number, dy: number): LatLng {
  const world = project(center, zoom);

  return normalizeLatLng(unproject({ x: world.x - dx, y: world.y - dy }, zoom));
}

/** The id of a place chosen on the map: it names the spot (to about 10 cm), so the same spot always has the same id. */
export function mapPlaceId(point: LatLng) {
  return `map:${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
}
