'use client';

import { MAP_ATTRIBUTION, MAP_ATTRIBUTION_URL, MAP_TILE_URL } from '@/lib/map-config';
import { tileUrl, tilesForView, type MapView } from '@/lib/map-math';

/**
 * The picture of a map: the tiles that cover the view, each placed where it belongs. The tiles come from the tile server the
 * Content-Security-Policy allows (lib/map-config.ts). A tile that can't load is hidden, so the box behind shows instead.
 * Put it inside a `relative` box that is the size of the view.
 */
export default function MapTiles({ view }: { view: MapView }) {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      {tilesForView(view).map((tile) => (
        // Map tiles from another site (the CSP allows only that address); next/image can't be used for those.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={tile.key}
          src={tileUrl(MAP_TILE_URL, tile)}
          alt=""
          width={256}
          height={256}
          draggable={false}
          referrerPolicy="origin"
          onError={(event) => {
            event.currentTarget.style.visibility = 'hidden';
          }}
          className="pointer-events-none absolute max-w-none select-none"
          style={{ left: tile.left, top: tile.top }}
        />
      ))}
    </div>
  );
}

/** The credit line the tile provider asks for, bottom right of the map. */
export function MapAttribution() {
  return (
    <a
      href={MAP_ATTRIBUTION_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="absolute bottom-0 right-0 rounded-tl-md bg-white/80 px-1.5 py-0.5 text-[10px] text-gray-700 hover:underline"
    >
      {MAP_ATTRIBUTION}
    </a>
  );
}
