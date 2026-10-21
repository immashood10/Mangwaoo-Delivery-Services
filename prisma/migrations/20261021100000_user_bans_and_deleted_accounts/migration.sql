-- Admin > Users: bans (for hours up to years, or permanent) and deleted accounts.
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE TABLE "UserBan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endsAt" TIMESTAMP(3),
    "permanent" BOOLEAN NOT NULL DEFAULT false,
    "durationLabel" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftedAt" TIMESTAMP(3),

    CONSTRAINT "UserBan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserBan_userId_createdAt_idx" ON "UserBan"("userId", "createdAt");

ALTER TABLE "UserBan" ADD CONSTRAINT "UserBan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
