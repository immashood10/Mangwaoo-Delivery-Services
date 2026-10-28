-- Loyalty Card: a customer who has had enough orders delivered can apply, an admin approves, and from then on every order
-- gets a random discount. Additive: the earlier code never sets the new order columns (they default to 0 / null) and
-- ignores the new tables.

-- CreateEnum
CREATE TYPE "LoyaltyCardStatus" AS ENUM ('ELIGIBLE', 'PENDING', 'APPROVED', 'REJECTED', 'REVOKED');

-- AlterTable
ALTER TABLE "GulplazaOrder" ADD COLUMN     "loyaltyDiscount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "loyaltyPercent" INTEGER,
ADD COLUMN     "loyaltyRedemptionId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "loyaltyDiscount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "loyaltyPercent" INTEGER,
ADD COLUMN     "loyaltyRedemptionId" TEXT;

-- CreateTable
CREATE TABLE "LoyaltyCard" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "cardNumber" SERIAL NOT NULL,
    "status" "LoyaltyCardStatus" NOT NULL DEFAULT 'ELIGIBLE',
    "nextPercent" INTEGER,
    "eligibleAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyRedemption" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "percent" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "LoyaltyRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyCardSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "ordersRequired" INTEGER NOT NULL DEFAULT 20,
    "percentMin" INTEGER NOT NULL DEFAULT 1,
    "percentMax" INTEGER NOT NULL DEFAULT 10,
    "maxDiscount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyCardSettings_pkey" PRIMARY KEY ("id")
);

-- Card numbers start at MW-LC10001, like the order numbers.
SELECT setval(pg_get_serial_sequence('"LoyaltyCard"', 'cardNumber'), 10000);

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyCard_customerId_key" ON "LoyaltyCard"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyCard_cardNumber_key" ON "LoyaltyCard"("cardNumber");

-- CreateIndex
CREATE INDEX "LoyaltyCard_status_appliedAt_idx" ON "LoyaltyCard"("status", "appliedAt");

-- CreateIndex
CREATE INDEX "LoyaltyRedemption_cardId_createdAt_idx" ON "LoyaltyRedemption"("cardId", "createdAt");

-- CreateIndex
CREATE INDEX "LoyaltyRedemption_customerId_idx" ON "LoyaltyRedemption"("customerId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_loyaltyRedemptionId_fkey" FOREIGN KEY ("loyaltyRedemptionId") REFERENCES "LoyaltyRedemption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GulplazaOrder" ADD CONSTRAINT "GulplazaOrder_loyaltyRedemptionId_fkey" FOREIGN KEY ("loyaltyRedemptionId") REFERENCES "LoyaltyRedemption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyCard" ADD CONSTRAINT "LoyaltyCard_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyRedemption" ADD CONSTRAINT "LoyaltyRedemption_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "LoyaltyCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyRedemption" ADD CONSTRAINT "LoyaltyRedemption_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Safety nets the application also keeps: a drawn discount is a real percent, an approved card always has its next draw,
-- and the rules can't be saved nonsensical.
ALTER TABLE "LoyaltyCard" ADD CONSTRAINT "LoyaltyCard_nextPercent_range" CHECK ("nextPercent" IS NULL OR ("nextPercent" >= 1 AND "nextPercent" <= 100));
ALTER TABLE "LoyaltyCard" ADD CONSTRAINT "LoyaltyCard_approved_has_draw" CHECK ("status" <> 'APPROVED' OR "nextPercent" IS NOT NULL);
ALTER TABLE "LoyaltyRedemption" ADD CONSTRAINT "LoyaltyRedemption_percent_range" CHECK ("percent" >= 1 AND "percent" <= 100);
ALTER TABLE "LoyaltyRedemption" ADD CONSTRAINT "LoyaltyRedemption_amount_not_negative" CHECK ("amount" >= 0);
ALTER TABLE "LoyaltyCardSettings" ADD CONSTRAINT "LoyaltyCardSettings_rules_sane" CHECK ("ordersRequired" >= 1 AND "percentMin" >= 1 AND "percentMax" >= "percentMin" AND "percentMax" <= 100 AND "maxDiscount" >= 0);
