CREATE TYPE "CustomerGender" AS ENUM ('MAN', 'WOMAN', 'NON_BINARY');

ALTER TABLE "Customer"
  ADD COLUMN "dateOfBirth" DATE,
  ADD COLUMN "gender" "CustomerGender";

ALTER TABLE "ProductAd"
  ADD COLUMN "targetAgeMin" INTEGER,
  ADD COLUMN "targetAgeMax" INTEGER,
  ADD COLUMN "targetGender" "CustomerGender",
  ADD CONSTRAINT "ProductAd_targetAgeMin_check" CHECK ("targetAgeMin" IS NULL OR "targetAgeMin" BETWEEN 18 AND 120),
  ADD CONSTRAINT "ProductAd_targetAgeMax_check" CHECK ("targetAgeMax" IS NULL OR "targetAgeMax" BETWEEN 18 AND 120),
  ADD CONSTRAINT "ProductAd_targetAgeRange_check" CHECK (
    ("targetAgeMin" IS NOT NULL OR "targetAgeMax" IS NULL)
    AND ("targetAgeMax" IS NULL OR "targetAgeMin" <= "targetAgeMax")
  );
