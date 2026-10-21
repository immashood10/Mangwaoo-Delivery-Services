-- Notification type for ad requests being approved / rejected.
ALTER TYPE "NotificationType" ADD VALUE 'AD';

-- Paid product ads: a seller pays a flat price to feature a product for a week.
CREATE TYPE "AdPlacement" AS ENUM ('SIDEBAR', 'MAIN_PAGE');

CREATE TYPE "AdStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED');

CREATE TABLE "ProductAd" (
    "id" TEXT NOT NULL,
    "placement" "AdPlacement" NOT NULL,
    "status" "AdStatus" NOT NULL DEFAULT 'PENDING',
    "amount" INTEGER NOT NULL,
    "paymentRef" TEXT NOT NULL,
    "rejectionReason" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,

    CONSTRAINT "ProductAd_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductAd_status_placement_endsAt_idx" ON "ProductAd"("status", "placement", "endsAt");

CREATE INDEX "ProductAd_sellerId_createdAt_idx" ON "ProductAd"("sellerId", "createdAt");

ALTER TABLE "ProductAd" ADD CONSTRAINT "ProductAd_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductAd" ADD CONSTRAINT "ProductAd_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- When an order was delivered, so "products sold" can be charted by delivery day.
ALTER TABLE "Order" ADD COLUMN "deliveredAt" TIMESTAMP(3);
ALTER TABLE "GulplazaOrder" ADD COLUMN "deliveredAt" TIMESTAMP(3);

UPDATE "Order" SET "deliveredAt" = "updatedAt" WHERE "status" = 'DELIVERED';
UPDATE "GulplazaOrder" SET "deliveredAt" = "updatedAt" WHERE "status" = 'DELIVERED';
