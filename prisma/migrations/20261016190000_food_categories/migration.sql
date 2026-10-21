-- Food categories for the Food marketplace (the names shown on /gulplaza, see GULPLAZA_CATEGORIES
-- in lib/data.ts). The table only held the older electronics-plaza categories, so a restaurant
-- had nothing sensible to file a dish under. Existing rows are left alone.
INSERT INTO "GulplazaCategory" ("id", "name")
VALUES
  (gen_random_uuid()::text, 'Restaurants & Cloud Kitchens'),
  (gen_random_uuid()::text, 'Bakery & Desserts'),
  (gen_random_uuid()::text, 'Beverages'),
  (gen_random_uuid()::text, 'Fast Food'),
  (gen_random_uuid()::text, 'Home-Cooked & Tiffin'),
  (gen_random_uuid()::text, 'Catering & Bulk Orders')
ON CONFLICT ("name") DO NOTHING;
