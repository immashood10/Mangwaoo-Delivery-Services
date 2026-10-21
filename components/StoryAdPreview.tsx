import { storyBackgroundStyle } from '@/lib/story-types';
import type { AdCardData } from '@/lib/ads';

/** A small phone-shaped preview of a product's Story ad, as people will see it when they tap the logo. */
export default function StoryAdPreview({ ad }: { ad: AdCardData }) {
  return (
    <div className="relative mx-auto aspect-[9/16] w-44 overflow-hidden rounded-2xl bg-black text-white shadow-soft">
      {ad.hasImage ? (
        <>
          {/* The same soft blurred copy behind the photo that the story player shows. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 scale-125 bg-cover bg-center opacity-60 blur-2xl"
            style={{ backgroundImage: `url(/api/products/${ad.id}/image)` }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- served by /api/products/[id]/image */}
          <img src={`/api/products/${ad.id}/image`} alt="" className="relative h-full w-full object-contain" />
        </>
      ) : (
        <div className="flex h-full items-center justify-center px-4 text-center" style={storyBackgroundStyle('red')}>
          <p className="line-clamp-6 break-words text-sm font-bold leading-snug">{ad.name}</p>
        </div>
      )}

      <div className="absolute inset-x-0 top-0 flex items-center gap-1.5 bg-gradient-to-b from-black/60 to-transparent px-2.5 pb-4 pt-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-red-primary text-[11px] font-bold">
          {ad.storeName.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[11px] font-semibold">{ad.storeName}</span>
          <span className="block text-[9px] text-white/75">Featured</span>
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-3 pt-10 text-center">
        {ad.hasImage ? <p className="line-clamp-2 text-[11px] font-semibold leading-snug">{ad.name}</p> : null}
        <p className="text-[11px] text-white/85">PKR {ad.price.toLocaleString()}</p>
        <span className="mt-1.5 inline-block rounded-full bg-white px-3 py-1 text-[10px] font-bold text-black">View product</span>
      </div>
    </div>
  );
}
