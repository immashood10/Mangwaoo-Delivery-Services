-- Mangwaoo Points: random points on every delivered order, cashback into a customer wallet, withdrawals to JazzCash / EasyPaisa.
-- Additive: two new columns with a default on "Customer" and new tables; the code that is live today ignores all of it.

-- CreateEnum
CREATE TYPE "PointsEntryType" AS ENUM ('EARNED', 'REDEEMED', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "WalletEntryType" AS ENUM ('CASHBACK', 'WITHDRAWAL', 'WITHDRAWAL_REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('EASYPAISA', 'JAZZCASH');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "walletBalance" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PointsEntry" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "PointsEntryType" NOT NULL,
    "points" INTEGER NOT NULL,
    "orderKind" TEXT,
    "orderId" TEXT,
    "orderRef" TEXT,
    "cashback" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointsEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletEntry" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "WalletEntryType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "withdrawalId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletWithdrawal" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PayoutMethod" NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "transactionId" TEXT,
    "rejectionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltySettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "pointsMin" INTEGER NOT NULL DEFAULT 1,
    "pointsMax" INTEGER NOT NULL DEFAULT 100,
    "redeemPoints" INTEGER NOT NULL DEFAULT 500,
    "cashbackMin" INTEGER NOT NULL DEFAULT 1,
    "cashbackMax" INTEGER NOT NULL DEFAULT 10,
    "minWithdrawal" INTEGER NOT NULL DEFAULT 1,
    "minOrderAmount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltySettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PointsEntry_customerId_createdAt_idx" ON "PointsEntry"("customerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PointsEntry_orderKind_orderId_key" ON "PointsEntry"("orderKind", "orderId");

-- CreateIndex
CREATE INDEX "WalletEntry_customerId_createdAt_idx" ON "WalletEntry"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletEntry_withdrawalId_idx" ON "WalletEntry"("withdrawalId");

-- CreateIndex
CREATE INDEX "WalletWithdrawal_status_createdAt_idx" ON "WalletWithdrawal"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WalletWithdrawal_customerId_createdAt_idx" ON "WalletWithdrawal"("customerId", "createdAt");

-- AddForeignKey
ALTER TABLE "PointsEntry" ADD CONSTRAINT "PointsEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletEntry" ADD CONSTRAINT "WalletEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletWithdrawal" ADD CONSTRAINT "WalletWithdrawal_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Money safety net on top of the code: a balance can never go below zero and a withdrawal is always for something.
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_points_not_negative" CHECK ("points" >= 0);
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_walletBalance_not_negative" CHECK ("walletBalance" >= 0);
ALTER TABLE "WalletWithdrawal" ADD CONSTRAINT "WalletWithdrawal_amount_positive" CHECK ("amount" > 0);
