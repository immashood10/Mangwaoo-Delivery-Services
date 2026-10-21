-- An anonymous browser, identified by an opaque cookie (only the token's hash is stored as the id).
-- Holds what the site remembers about a visitor so none of it has to live in the browser's own storage:
-- whether the first-visit location question was answered, and the delivery location last shared.
CREATE TABLE "Visitor" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locationPromptedAt" TIMESTAMP(3),
    "lastLatitude" DOUBLE PRECISION,
    "lastLongitude" DOUBLE PRECISION,
    "lastLocationLabel" TEXT,
    "lastPostalCode" TEXT,

    CONSTRAINT "Visitor_pkey" PRIMARY KEY ("id")
);

-- Old, unused visitors are purged by date.
CREATE INDEX "Visitor_lastSeenAt_idx" ON "Visitor"("lastSeenAt");
