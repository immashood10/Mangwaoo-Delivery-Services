-- CreateTable
CREATE TABLE "RiderTopUpScreenshot" (
    "id" TEXT NOT NULL,
    "topUpId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiderTopUpScreenshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RiderTopUpScreenshot_topUpId_key" ON "RiderTopUpScreenshot"("topUpId");

-- AddForeignKey
ALTER TABLE "RiderTopUpScreenshot" ADD CONSTRAINT "RiderTopUpScreenshot_topUpId_fkey" FOREIGN KEY ("topUpId") REFERENCES "RiderTopUp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

