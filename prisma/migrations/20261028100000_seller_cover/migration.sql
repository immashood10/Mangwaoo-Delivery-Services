-- AlterTable
ALTER TABLE "Seller" ADD COLUMN     "coverUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SellerCover" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerCover_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SellerCover_sellerId_key" ON "SellerCover"("sellerId");

-- AddForeignKey
ALTER TABLE "SellerCover" ADD CONSTRAINT "SellerCover_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;
