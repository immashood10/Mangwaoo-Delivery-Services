ALTER TABLE "Order" ADD COLUMN "riderChatId" TEXT;
ALTER TABLE "GulplazaOrder" ADD COLUMN "riderChatId" TEXT;

CREATE INDEX "Order_riderChatId_idx" ON "Order"("riderChatId");
CREATE INDEX "GulplazaOrder_riderChatId_idx" ON "GulplazaOrder"("riderChatId");

ALTER TABLE "Order"
ADD CONSTRAINT "Order_riderChatId_fkey"
FOREIGN KEY ("riderChatId") REFERENCES "RiderChat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GulplazaOrder"
ADD CONSTRAINT "GulplazaOrder_riderChatId_fkey"
FOREIGN KEY ("riderChatId") REFERENCES "RiderChat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Riders already on the unpaid-order hold must not remain shown as online after this rule is enforced.
UPDATE "Rider" SET "isAvailable" = false, "lastSeenAt" = NULL WHERE "paymentHold" = true;
