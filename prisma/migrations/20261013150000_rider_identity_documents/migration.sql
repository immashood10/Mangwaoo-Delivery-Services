-- CreateEnum
CREATE TYPE "RiderDocumentKind" AS ENUM ('CNIC_FRONT', 'CNIC_BACK');

-- AlterTable
ALTER TABLE "Rider" ADD COLUMN     "cnicNumber" TEXT,
ADD COLUMN     "numberPlate" TEXT;

-- CreateTable
CREATE TABLE "RiderDocument" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "kind" "RiderDocumentKind" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiderDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rider_cnicNumber_key" ON "Rider"("cnicNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RiderDocument_riderId_kind_key" ON "RiderDocument"("riderId", "kind");

-- AddForeignKey
ALTER TABLE "RiderDocument" ADD CONSTRAINT "RiderDocument_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
