import type { Prisma } from '@/lib/generated/prisma/client';
import { detectImageType } from '@/lib/stories';
import { DEFAULT_STORY_BACKGROUND, MAX_STORY_CAPTION_LENGTH } from '@/lib/story-types';

// A paid "Story ad" runs as a story on the Mangwaoo logo. The story is made from the ad's product when an admin
// approves (or puts back) the ad, and it expires with the ad. These run inside the transaction that updates the ad.

type Tx = Prisma.TransactionClient;

const SERVABLE_PHOTO = /^data:image\/(?:jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/;

/** The product's first photo if it is one the story player can show (JPEG, PNG or WebP). */
function firstPhoto(images: string[]) {
  const match = images[0]?.match(SERVABLE_PHOTO);
  if (!match) return null;

  const data = new Uint8Array(Buffer.from(match[1], 'base64'));
  const mimeType = detectImageType(data);

  return mimeType ? { data, mimeType } : null;
}

/**
 * Makes (or remakes) the story for a STORY ad: the product's photo with its name and price and a button to the
 * product, or the name and price on a colour when it has no usable photo. It is a snapshot taken now, so the story
 * stays as the seller paid for it. A new run starts unseen for everybody.
 */
export async function publishAdStory(tx: Tx, ad: { id: string; productId: string }, startsAt: Date, endsAt: Date) {
  const product = await tx.product.findUnique({
    where: { id: ad.productId },
    select: { id: true, name: true, price: true, images: true },
  });

  if (!product) return;

  const photo = firstPhoto(product.images);
  const fields = {
    kind: photo ? ('IMAGE' as const) : ('TEXT' as const),
    caption: `${product.name}\nPKR ${Number(product.price).toLocaleString('en-US')}`.slice(0, MAX_STORY_CAPTION_LENGTH),
    background: photo ? null : DEFAULT_STORY_BACKGROUND,
    mimeType: photo?.mimeType ?? null,
    size: photo?.data.length ?? null,
    data: photo?.data ?? null,
    href: `/mart/${product.id}`,
    createdAt: startsAt,
    expiresAt: endsAt,
  };

  const story = await tx.story.upsert({
    where: { adId: ad.id },
    create: { ...fields, adId: ad.id },
    update: fields,
    select: { id: true },
  });

  await tx.storyView.deleteMany({ where: { storyId: story.id } });
}

/** Takes a STORY ad's story off the logo right now (its record and views stay until it is cleared out later). */
export async function endAdStory(tx: Tx, adId: string, now: Date) {
  await tx.story.updateMany({ where: { adId }, data: { expiresAt: now } });
}
