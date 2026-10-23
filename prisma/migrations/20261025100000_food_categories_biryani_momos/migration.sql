-- Two more food categories (see GULPLAZA_CATEGORIES in lib/data.ts). Existing rows are left alone.
INSERT INTO "GulplazaCategory" ("id", "name")
VALUES
  (gen_random_uuid()::text, 'Biryani & Pulao'),
  (gen_random_uuid()::text, 'Dumplings & Momos')
ON CONFLICT ("name") DO NOTHING;

-- Dishes no longer have a stock count (lib/food-stock.ts): every existing dish becomes always available.
UPDATE "GulplazaProduct" SET "stock" = 100000 WHERE "stock" < 100000;
