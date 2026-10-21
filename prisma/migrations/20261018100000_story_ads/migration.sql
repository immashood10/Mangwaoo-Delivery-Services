-- Story ads: a seller can pay for a product to run as a story on the Mangwaoo logo for one day.
-- The ad has its own placement; when an admin approves it, a Story row (linked by adId) is made from the product.
ALTER TYPE "AdPlacement" ADD VALUE 'STORY';

-- Where a tap on a story's button goes, and the ad a story was made from.
ALTER TABLE "Story" ADD COLUMN "href" TEXT;
ALTER TABLE "Story" ADD COLUMN "adId" TEXT;

CREATE UNIQUE INDEX "Story_adId_key" ON "Story"("adId");

ALTER TABLE "Story" ADD CONSTRAINT "Story_adId_fkey" FOREIGN KEY ("adId") REFERENCES "ProductAd"("id") ON DELETE CASCADE ON UPDATE CASCADE;
