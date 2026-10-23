-- CreateEnum
CREATE TYPE "RiderOrderAccess" AS ENUM ('AUTO', 'ALLOWED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "RiderLedgerType" AS ENUM ('COMMISSION', 'TOP_UP', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "RiderTopUpStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Rider" ADD COLUMN     "orderAccess" "RiderOrderAccess" NOT NULL DEFAULT 'AUTO',
ADD COLUMN     "paymentHold" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unpaidOrders" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "walletBalance" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "RiderLedgerEntry" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "type" "RiderLedgerType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "baseAmount" INTEGER,
    "chatId" TEXT,
    "topUpId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiderLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiderTopUp" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "status" "RiderTopUpStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiderTopUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiderWalletSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "commissionPercent" INTEGER NOT NULL DEFAULT 30,
    "ordersOnCredit" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiderWalletSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RiderLedgerEntry_chatId_key" ON "RiderLedgerEntry"("chatId");

-- CreateIndex
CREATE UNIQUE INDEX "RiderLedgerEntry_topUpId_key" ON "RiderLedgerEntry"("topUpId");

-- CreateIndex
CREATE INDEX "RiderLedgerEntry_riderId_createdAt_idx" ON "RiderLedgerEntry"("riderId", "createdAt");

-- CreateIndex
CREATE INDEX "RiderTopUp_status_createdAt_idx" ON "RiderTopUp"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RiderTopUp_riderId_createdAt_idx" ON "RiderTopUp"("riderId", "createdAt");

-- CreateIndex
CREATE INDEX "RiderTopUp_transactionId_idx" ON "RiderTopUp"("transactionId");

-- AddForeignKey
ALTER TABLE "RiderLedgerEntry" ADD CONSTRAINT "RiderLedgerEntry_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderTopUp" ADD CONSTRAINT "RiderTopUp_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- The commission rule starts at 30% with 5 orders on credit (editable in Admin > Rider Wallets).
INSERT INTO "RiderWalletSettings" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
