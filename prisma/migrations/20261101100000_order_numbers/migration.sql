-- Every order gets a number customers and sellers can quote (MW-M10001 for MangwaooMart, MW-F10001 for food).
-- Additive: the old code never sets it and the column fills itself.
ALTER TABLE "Order" ADD COLUMN "orderNumber" SERIAL NOT NULL;
ALTER TABLE "GulplazaOrder" ADD COLUMN "orderNumber" SERIAL NOT NULL;

-- Orders placed so far get 10001, 10002 ... in the order they were placed, and the counters carry on from there.
UPDATE "Order" o SET "orderNumber" = 10000 + r.n FROM (SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS n FROM "Order") r WHERE o."id" = r."id";
UPDATE "GulplazaOrder" o SET "orderNumber" = 10000 + r.n FROM (SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS n FROM "GulplazaOrder") r WHERE o."id" = r."id";
SELECT setval(pg_get_serial_sequence('"Order"', 'orderNumber'), GREATEST(10000, COALESCE((SELECT MAX("orderNumber") FROM "Order"), 10000)));
SELECT setval(pg_get_serial_sequence('"GulplazaOrder"', 'orderNumber'), GREATEST(10000, COALESCE((SELECT MAX("orderNumber") FROM "GulplazaOrder"), 10000)));

CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE UNIQUE INDEX "GulplazaOrder_orderNumber_key" ON "GulplazaOrder"("orderNumber");
