CREATE TYPE "InAppCallStatus" AS ENUM ('RINGING', 'ACTIVE', 'DECLINED', 'ENDED');
CREATE TYPE "CallRecordingStatus" AS ENUM ('PENDING', 'STARTING', 'RECORDING', 'PROCESSING', 'READY', 'FAILED');

CREATE TABLE "InAppCall" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "roomName" TEXT NOT NULL,
  "callerUserId" TEXT NOT NULL,
  "receiverUserId" TEXT NOT NULL,
  "callerName" TEXT NOT NULL,
  "receiverName" TEXT NOT NULL,
  "callerConsentedAt" TIMESTAMP(3) NOT NULL,
  "receiverConsentedAt" TIMESTAMP(3),
  "status" "InAppCallStatus" NOT NULL DEFAULT 'RINGING',
  "recordingStatus" "CallRecordingStatus" NOT NULL DEFAULT 'PENDING',
  "egressId" TEXT,
  "recordingObjectKey" TEXT,
  "startedAt" TIMESTAMP(3),
  "disconnectedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InAppCall_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InAppCall_roomName_key" ON "InAppCall"("roomName");
CREATE UNIQUE INDEX "InAppCall_egressId_key" ON "InAppCall"("egressId");
CREATE INDEX "InAppCall_kind_targetId_status_createdAt_idx" ON "InAppCall"("kind", "targetId", "status", "createdAt");
CREATE INDEX "InAppCall_callerUserId_status_createdAt_idx" ON "InAppCall"("callerUserId", "status", "createdAt");
CREATE INDEX "InAppCall_receiverUserId_status_createdAt_idx" ON "InAppCall"("receiverUserId", "status", "createdAt");
CREATE UNIQUE INDEX "InAppCall_one_open_per_target_key" ON "InAppCall"("kind", "targetId") WHERE "status" IN ('RINGING', 'ACTIVE');
