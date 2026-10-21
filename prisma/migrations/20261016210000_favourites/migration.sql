-- Restaurants and dishes a signed-in user saved with the heart button (the Favourites page).
CREATE TYPE "FavouriteKind" AS ENUM ('RESTAURANT', 'DISH');

CREATE TABLE "Favourite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "FavouriteKind" NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favourite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Favourite_userId_kind_targetId_key" ON "Favourite"("userId", "kind", "targetId");

CREATE INDEX "Favourite_userId_createdAt_idx" ON "Favourite"("userId", "createdAt");

ALTER TABLE "Favourite" ADD CONSTRAINT "Favourite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
