-- Rider-initiated cancellations accrue a capped consecutive streak. The next delivered order records one negative FINE
-- ledger entry, with a higher random range after three consecutive cancellations; successful delivery clears the streak.

ALTER TYPE "RiderLedgerType" ADD VALUE 'FINE';

ALTER TABLE "Rider"
ADD COLUMN "riderCancelStreak" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Rider"
ADD CONSTRAINT "Rider_cancel_streak_sane" CHECK ("riderCancelStreak" BETWEEN 0 AND 3);

ALTER TABLE "RiderLedgerEntry"
ADD COLUMN "fineChatId" TEXT;

CREATE UNIQUE INDEX "RiderLedgerEntry_fineChatId_key" ON "RiderLedgerEntry"("fineChatId");

ALTER TABLE "RiderLedgerEntry"
ADD CONSTRAINT "RiderLedgerEntry_fine_line"
CHECK ("type"::text <> 'FINE' OR ("amount" < 0 AND "fineChatId" IS NOT NULL));
