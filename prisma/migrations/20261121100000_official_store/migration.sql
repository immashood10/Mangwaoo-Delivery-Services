-- Mangwaoo's own store in MangwaooMart: one seller flagged official (named "Mangwaoo"), only one allowed. Additive: the older code
-- ignores the new column.
ALTER TABLE "Seller" ADD COLUMN "isOfficial" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "Seller_one_official" ON "Seller"("isOfficial") WHERE "isOfficial";

-- The MangwaooMart categories of lib/data.ts MART_CATEGORIES that were not rows yet (only Vehicles and Sports were), so Mangwaoo
-- (and any MangwaooMart seller) can post under them. Safe to re-run.
INSERT INTO "Category" ("id", "name") VALUES
  ('cat_fruits_vegetables', 'Fruits & Vegetables'),
  ('cat_dairy_eggs', 'Dairy & Eggs'),
  ('cat_snacks_beverages', 'Snacks & Beverages'),
  ('cat_household_essentials', 'Household Essentials'),
  ('cat_personal_care', 'Personal Care'),
  ('cat_meat_seafood', 'Meat & Seafood'),
  ('cat_men', 'Men'),
  ('cat_women', 'Women'),
  ('cat_kids', 'Kids')
ON CONFLICT ("name") DO NOTHING;
