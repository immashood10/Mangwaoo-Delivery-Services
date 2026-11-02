CREATE TABLE "ChatTypingIndicator" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "senderRole" TEXT NOT NULL,
  "senderName" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChatTypingIndicator_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChatTypingIndicator_kind_targetId_userId_key" ON "ChatTypingIndicator"("kind", "targetId", "userId");
CREATE INDEX "ChatTypingIndicator_kind_targetId_expiresAt_idx" ON "ChatTypingIndicator"("kind", "targetId", "expiresAt");
