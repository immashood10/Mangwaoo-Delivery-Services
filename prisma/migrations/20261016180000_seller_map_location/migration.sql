-- Where a seller's shop / kitchen is on the map. Food search lists the restaurants
-- nearest to the customer first; sellers who haven't pinned a location are listed last.
ALTER TABLE "Seller" ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION,
ADD COLUMN "locationLabel" TEXT;
