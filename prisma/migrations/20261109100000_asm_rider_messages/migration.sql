CREATE TABLE "AreaManagerRiderThread" (
    "id" TEXT NOT NULL,
    "managerUserId" TEXT NOT NULL,
    "riderUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AreaManagerRiderThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AreaManagerRiderMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AreaManagerRiderMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AreaManagerRiderThread_managerUserId_riderUserId_key" ON "AreaManagerRiderThread"("managerUserId", "riderUserId");
CREATE INDEX "AreaManagerRiderThread_riderUserId_updatedAt_idx" ON "AreaManagerRiderThread"("riderUserId", "updatedAt");
CREATE INDEX "AreaManagerRiderMessage_threadId_createdAt_idx" ON "AreaManagerRiderMessage"("threadId", "createdAt");

ALTER TABLE "AreaManagerRiderThread" ADD CONSTRAINT "AreaManagerRiderThread_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AreaManagerRiderThread" ADD CONSTRAINT "AreaManagerRiderThread_riderUserId_fkey" FOREIGN KEY ("riderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AreaManagerRiderMessage" ADD CONSTRAINT "AreaManagerRiderMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AreaManagerRiderThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AreaManagerRiderMessage" ADD CONSTRAINT "AreaManagerRiderMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
