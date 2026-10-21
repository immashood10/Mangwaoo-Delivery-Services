-- Stories: WhatsApp-status style posts the admin puts on the website logo. A story lives for a day
-- (expiresAt); StoryView remembers who watched it so nothing has to be kept in the browser's own storage.
CREATE TYPE "StoryKind" AS ENUM ('IMAGE', 'TEXT');

CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "kind" "StoryKind" NOT NULL,
    "caption" TEXT,
    "background" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "data" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Story_expiresAt_idx" ON "Story"("expiresAt");

CREATE TABLE "StoryView" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "viewerKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoryView_storyId_viewerKey_key" ON "StoryView"("storyId", "viewerKey");

CREATE INDEX "StoryView_viewerKey_idx" ON "StoryView"("viewerKey");

ALTER TABLE "StoryView" ADD CONSTRAINT "StoryView_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
