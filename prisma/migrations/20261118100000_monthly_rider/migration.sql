-- CreateEnum
CREATE TYPE "MonthlyRiderStatus" AS ENUM ('REQUESTED', 'QUOTED', 'PAYMENT_SENT', 'ACTIVE', 'ENDED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "MonthlyRiderBooking" (
    "id" TEXT NOT NULL,
    "refNumber" SERIAL NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "MonthlyRiderStatus" NOT NULL DEFAULT 'REQUESTED',
    "areaId" INTEGER NOT NULL,
    "addressText" TEXT NOT NULL,
    "preferredStart" DATE,
    "notes" TEXT,
    "priceRs" INTEGER,
    "riderId" TEXT,
    "quotedById" TEXT,
    "quotedAt" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "transactionId" TEXT,
    "paymentSentAt" TIMESTAMP(3),
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyRiderBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyRiderBooking_refNumber_key" ON "MonthlyRiderBooking"("refNumber");

-- CreateIndex
CREATE INDEX "MonthlyRiderBooking_status_createdAt_idx" ON "MonthlyRiderBooking"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MonthlyRiderBooking_areaId_status_idx" ON "MonthlyRiderBooking"("areaId", "status");

-- CreateIndex
CREATE INDEX "MonthlyRiderBooking_riderId_status_idx" ON "MonthlyRiderBooking"("riderId", "status");

-- CreateIndex
CREATE INDEX "MonthlyRiderBooking_customerId_createdAt_idx" ON "MonthlyRiderBooking"("customerId", "createdAt");

-- AddForeignKey
ALTER TABLE "MonthlyRiderBooking" ADD CONSTRAINT "MonthlyRiderBooking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyRiderBooking" ADD CONSTRAINT "MonthlyRiderBooking_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- A customer can have only one running booking at a time (asked for, priced, paid or active).
CREATE UNIQUE INDEX "MonthlyRiderBooking_one_running_per_customer"
  ON "MonthlyRiderBooking"("customerId")
  WHERE "status" IN ('REQUESTED', 'QUOTED', 'PAYMENT_SENT', 'ACTIVE');

ALTER TABLE "MonthlyRiderBooking"
  ADD CONSTRAINT "MonthlyRiderBooking_priceRs_check" CHECK ("priceRs" IS NULL OR "priceRs" > 0);
