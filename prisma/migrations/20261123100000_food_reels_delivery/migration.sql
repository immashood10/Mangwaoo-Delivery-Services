-- CreateEnum
CREATE TYPE "ReelStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "deliveryDays" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "areaId" INTEGER,
ADD COLUMN     "deliveryMaxDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deliveryMinDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "vendorFulfilled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RiderChat" ADD COLUMN     "managerOnly" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "GulplazaProduct" ADD COLUMN     "deliveryDays" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "GulplazaOrder" ADD COLUMN     "areaId" INTEGER,
ADD COLUMN     "deliveryMaxDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deliveryMinDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "vendorFulfilled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Reel" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "status" "ReelStatus" NOT NULL DEFAULT 'PENDING',
    "linkedProductId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReelVideo" (
    "id" TEXT NOT NULL,
    "reelId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "ReelVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReelLike" (
    "reelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReelLike_pkey" PRIMARY KEY ("reelId","userId")
);

-- CreateTable
CREATE TABLE "ReelComment" (
    "id" TEXT NOT NULL,
    "reelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReelComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reel_status_createdAt_id_idx" ON "Reel"("status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Reel_authorId_createdAt_idx" ON "Reel"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "Reel_linkedProductId_idx" ON "Reel"("linkedProductId");

-- CreateIndex
CREATE INDEX "Reel_reviewedById_idx" ON "Reel"("reviewedById");

-- CreateIndex
CREATE UNIQUE INDEX "ReelVideo_reelId_key" ON "ReelVideo"("reelId");

-- CreateIndex
CREATE INDEX "ReelLike_userId_idx" ON "ReelLike"("userId");

-- CreateIndex
CREATE INDEX "ReelComment_reelId_createdAt_idx" ON "ReelComment"("reelId", "createdAt");

-- CreateIndex
CREATE INDEX "ReelComment_userId_idx" ON "ReelComment"("userId");

-- CreateIndex
CREATE INDEX "Order_areaId_createdAt_idx" ON "Order"("areaId", "createdAt");

-- CreateIndex
CREATE INDEX "GulplazaOrder_areaId_createdAt_idx" ON "GulplazaOrder"("areaId", "createdAt");

-- AddForeignKey
ALTER TABLE "Reel" ADD CONSTRAINT "Reel_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reel" ADD CONSTRAINT "Reel_linkedProductId_fkey" FOREIGN KEY ("linkedProductId") REFERENCES "GulplazaProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reel" ADD CONSTRAINT "Reel_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReelVideo" ADD CONSTRAINT "ReelVideo_reelId_fkey" FOREIGN KEY ("reelId") REFERENCES "Reel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReelLike" ADD CONSTRAINT "ReelLike_reelId_fkey" FOREIGN KEY ("reelId") REFERENCES "Reel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReelLike" ADD CONSTRAINT "ReelLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReelComment" ADD CONSTRAINT "ReelComment_reelId_fkey" FOREIGN KEY ("reelId") REFERENCES "Reel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReelComment" ADD CONSTRAINT "ReelComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- No browser Data API access: the application uses its existing server-only Prisma session.
ALTER TABLE "Reel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReelVideo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReelLike" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReelComment" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "Reel", "ReelVideo", "ReelLike", "ReelComment" FROM anon, authenticated;
ALTER TABLE "Product" ADD CONSTRAINT "Product_deliveryDays_check" CHECK ("deliveryDays" IN (0,3,5,7));
ALTER TABLE "GulplazaProduct" ADD CONSTRAINT "GulplazaProduct_deliveryDays_check" CHECK ("deliveryDays" IN (0,3,5,7));
ALTER TABLE "ReelVideo" ADD CONSTRAINT "ReelVideo_size_check" CHECK (size > 0 AND size <= 3145728 AND octet_length(data) = size);
ALTER TABLE "Reel" ADD CONSTRAINT "Reel_caption_check" CHECK (char_length(caption) BETWEEN 1 AND 500);
ALTER TABLE "ReelComment" ADD CONSTRAINT "ReelComment_body_check" CHECK (char_length(body) BETWEEN 1 AND 500);
