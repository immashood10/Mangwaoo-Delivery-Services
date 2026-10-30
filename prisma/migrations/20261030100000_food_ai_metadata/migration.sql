CREATE TYPE "FoodSpiceLevel" AS ENUM ('MILD', 'MEDIUM', 'HOT');

ALTER TABLE "GulplazaProduct"
ADD COLUMN "spiceLevel" "FoodSpiceLevel",
ADD COLUMN "dishTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
