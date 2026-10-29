-- Sports: a "Sports" MangwaooMart category sellers can post sports gear under (the Sports option of the top menu, /sports,
-- shows it). Additive and safe to re-run: it only adds one row, and the earlier code simply lists one more category.
INSERT INTO "Category" ("id", "name")
VALUES ('cat_sports', 'Sports')
ON CONFLICT ("name") DO NOTHING;
