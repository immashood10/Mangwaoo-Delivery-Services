-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "attributes" JSONB;

-- Vehicle ads: a "Vehicles" category sellers can post under (safe to re-run).
INSERT INTO "Category" ("id", "name")
VALUES ('cat_vehicles', 'Vehicles')
ON CONFLICT ("name") DO NOTHING;
