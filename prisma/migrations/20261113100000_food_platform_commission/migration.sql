-- Record Mangwaoo's food marketplace commission per food order.
-- Existing orders have no retrospective commission; new checkouts set the assessed amount.
ALTER TABLE "GulplazaOrder"
  ADD COLUMN "platformCommissionAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "platformCommissionPercent" INTEGER NOT NULL DEFAULT 0;
