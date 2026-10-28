-- Rider delivery bonus: a rider who completes an order gets a random bonus that depends on how far the order was (Rs 1-20 up to
-- 3 km, Rs 1-50 from 3 to 5 km, Rs 50-100 beyond). It is a BONUS line in the rider's wallet (positive money, so it is set off
-- against the commission owed). Additive: the earlier code never sets the new columns (they are null) and never writes a BONUS
-- line, and the new rules table is ignored by it.

-- AlterEnum
ALTER TYPE "RiderLedgerType" ADD VALUE 'BONUS';

-- AlterTable
ALTER TABLE "RiderChat" ADD COLUMN     "deliveryDistanceKm" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "RiderLedgerEntry" ADD COLUMN     "bonusChatId" TEXT;

-- AlterTable
ALTER TABLE "RiderOrderRecord" ADD COLUMN     "bonus" INTEGER;

-- CreateTable
CREATE TABLE "RiderBonusSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "nearMaxKm" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "midMaxKm" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "nearMin" INTEGER NOT NULL DEFAULT 1,
    "nearMax" INTEGER NOT NULL DEFAULT 20,
    "midMin" INTEGER NOT NULL DEFAULT 1,
    "midMax" INTEGER NOT NULL DEFAULT 50,
    "farMin" INTEGER NOT NULL DEFAULT 50,
    "farMax" INTEGER NOT NULL DEFAULT 100,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiderBonusSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RiderLedgerEntry_bonusChatId_key" ON "RiderLedgerEntry"("bonusChatId");

-- Safety nets the application also keeps: a bonus line is positive money for one order (the enum is compared as text, because a
-- value added in this same migration can't be used as an enum yet), and the rules can't be saved nonsensical.
ALTER TABLE "RiderLedgerEntry" ADD CONSTRAINT "RiderLedgerEntry_bonus_line" CHECK ("type"::text <> 'BONUS' OR ("amount" > 0 AND "bonusChatId" IS NOT NULL));
ALTER TABLE "RiderChat" ADD CONSTRAINT "RiderChat_distance_not_negative" CHECK ("deliveryDistanceKm" IS NULL OR "deliveryDistanceKm" >= 0);
ALTER TABLE "RiderOrderRecord" ADD CONSTRAINT "RiderOrderRecord_bonus_not_negative" CHECK ("bonus" IS NULL OR "bonus" >= 0);
ALTER TABLE "RiderBonusSettings" ADD CONSTRAINT "RiderBonusSettings_rules_sane" CHECK (
  "nearMaxKm" > 0 AND "midMaxKm" > "nearMaxKm" AND "midMaxKm" <= 1000
  AND "nearMin" >= 1 AND "nearMax" >= "nearMin" AND "nearMax" <= 100000
  AND "midMin" >= 1 AND "midMax" >= "midMin" AND "midMax" <= 100000
  AND "farMin" >= 1 AND "farMax" >= "farMin" AND "farMax" <= 100000
);
