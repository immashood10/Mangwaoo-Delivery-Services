-- A food seller can choose a picture (an emoji) for each dish; null = picked automatically from the dish's name.
ALTER TABLE "GulplazaProduct"
  ADD COLUMN "icon" TEXT,
  ADD CONSTRAINT "GulplazaProduct_icon_check" CHECK ("icon" IS NULL OR char_length("icon") <= 8);
