-- Security hardening: request limits, and sessions that stop working when the password is changed.
ALTER TABLE "User" ADD COLUMN "sessionsValidFrom" TIMESTAMP(3);

CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "RateLimit_windowStart_idx" ON "RateLimit"("windowStart");
