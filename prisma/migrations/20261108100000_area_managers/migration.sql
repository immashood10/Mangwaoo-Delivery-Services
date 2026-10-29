-- Area Sales Managers (ASM): the super admin makes a manager for a service area; the order chats a customer starts with the
-- Chat button go to the manager of the customer's area, who assigns the rider. Checkout orders stay "first rider to reply".
-- Additive: the earlier code never reads the new column (RiderChat.areaId, null = the old behaviour) or the new table.
-- Heads-up for the shared database: the earlier code cannot read a user whose role is ASM (it does not know the value), so
-- no manager account is made before the code that knows it is live.

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ASM';

-- AlterTable
ALTER TABLE "RiderChat" ADD COLUMN     "areaId" INTEGER;

-- CreateTable
CREATE TABLE "AreaManager" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "areaId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AreaManager_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AreaManager_userId_key" ON "AreaManager"("userId");

-- CreateIndex
CREATE INDEX "AreaManager_areaId_idx" ON "AreaManager"("areaId");

-- CreateIndex
CREATE INDEX "RiderChat_areaId_status_idx" ON "RiderChat"("areaId", "status");

-- AddForeignKey
ALTER TABLE "AreaManager" ADD CONSTRAINT "AreaManager_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
