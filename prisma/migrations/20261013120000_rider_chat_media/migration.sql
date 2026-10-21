-- CreateEnum
CREATE TYPE "RiderChatMessageType" AS ENUM ('TEXT', 'IMAGE', 'VOICE', 'LOCATION');

-- AlterTable
ALTER TABLE "RiderChatMessage" ADD COLUMN     "attachmentId" TEXT,
ADD COLUMN     "durationSec" INTEGER,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "type" "RiderChatMessageType" NOT NULL DEFAULT 'TEXT';

-- CreateTable
CREATE TABLE "RiderChatAttachment" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiderChatAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RiderChatMessage_attachmentId_key" ON "RiderChatMessage"("attachmentId");

-- CreateIndex
CREATE INDEX "RiderChatAttachment_chatId_idx" ON "RiderChatAttachment"("chatId");

-- AddForeignKey
ALTER TABLE "RiderChatMessage" ADD CONSTRAINT "RiderChatMessage_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "RiderChatAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderChatAttachment" ADD CONSTRAINT "RiderChatAttachment_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "RiderChat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
