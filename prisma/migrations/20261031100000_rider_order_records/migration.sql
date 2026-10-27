-- CreateEnum
CREATE TYPE "RiderOrderStatus" AS ENUM ('DELIVERED', 'CANCELLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RiderOrderCancelledBy" AS ENUM ('RIDER', 'CUSTOMER', 'ADMIN');

-- CreateTable
CREATE TABLE "RiderOrderRecord" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "pickupText" TEXT,
    "addressText" TEXT NOT NULL,
    "status" "RiderOrderStatus" NOT NULL,
    "cancelledBy" "RiderOrderCancelledBy",
    "deliveryCharge" INTEGER,
    "commission" INTEGER,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stars" INTEGER,
    "ratingComment" TEXT,
    "complaint" TEXT,
    "ratedAt" TIMESTAMP(3),
    "complaintResolvedAt" TIMESTAMP(3),

    CONSTRAINT "RiderOrderRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RiderOrderRecord_chatId_key" ON "RiderOrderRecord"("chatId");

-- CreateIndex
CREATE INDEX "RiderOrderRecord_riderId_endedAt_idx" ON "RiderOrderRecord"("riderId", "endedAt");

-- CreateIndex
CREATE INDEX "RiderOrderRecord_riderId_status_idx" ON "RiderOrderRecord"("riderId", "status");

-- CreateIndex
CREATE INDEX "RiderOrderRecord_ratedAt_idx" ON "RiderOrderRecord"("ratedAt");

-- AddForeignKey
ALTER TABLE "RiderOrderRecord" ADD CONSTRAINT "RiderOrderRecord_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderOrderRecord" ADD CONSTRAINT "RiderOrderRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

