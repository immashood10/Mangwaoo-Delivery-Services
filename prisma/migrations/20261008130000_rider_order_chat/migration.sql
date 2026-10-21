-- CreateEnum
CREATE TYPE "RiderChatStatus" AS ENUM ('OPEN', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "RiderChatSender" AS ENUM ('CUSTOMER', 'RIDER', 'ADMIN');

-- AlterTable
ALTER TABLE "Rider" ADD COLUMN     "isApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastLatitude" DOUBLE PRECISION,
ADD COLUMN     "lastLongitude" DOUBLE PRECISION,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RiderChat" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "riderId" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "addressText" TEXT NOT NULL,
    "status" "RiderChatStatus" NOT NULL DEFAULT 'OPEN',
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiderChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiderChatMessage" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "senderRole" "RiderChatSender" NOT NULL,
    "senderName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiderChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RiderChat_status_idx" ON "RiderChat"("status");

-- CreateIndex
CREATE INDEX "RiderChatMessage_chatId_createdAt_idx" ON "RiderChatMessage"("chatId", "createdAt");

-- AddForeignKey
ALTER TABLE "RiderChat" ADD CONSTRAINT "RiderChat_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderChat" ADD CONSTRAINT "RiderChat_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderChatMessage" ADD CONSTRAINT "RiderChatMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "RiderChat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
