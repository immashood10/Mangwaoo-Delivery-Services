-- Seller location, shown on the public store page and on each ad.
ALTER TABLE "Seller" ADD COLUMN "city" TEXT,
ADD COLUMN "country" TEXT NOT NULL DEFAULT 'Pakistan';

-- Public 10-digit "Ad ID". Existing ads are numbered in the order they were created
-- (the new column fills in table order, so renumber by createdAt first), and new
-- ads continue from the highest number.
ALTER TABLE "Product" ADD COLUMN "adNumber" SERIAL NOT NULL;

UPDATE "Product" p
SET "adNumber" = 1117937000 + numbered.rn
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS rn FROM "Product"
) numbered
WHERE p."id" = numbered."id";

SELECT setval('"Product_adNumber_seq"', COALESCE((SELECT MAX("adNumber") FROM "Product"), 1117937000));

CREATE UNIQUE INDEX "Product_adNumber_key" ON "Product"("adNumber");

-- Likes (hearts) on ads.
CREATE TABLE "ProductLike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductLike_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductLike_productId_idx" ON "ProductLike"("productId");

CREATE UNIQUE INDEX "ProductLike_userId_productId_key" ON "ProductLike"("userId", "productId");

ALTER TABLE "ProductLike" ADD CONSTRAINT "ProductLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductLike" ADD CONSTRAINT "ProductLike_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
