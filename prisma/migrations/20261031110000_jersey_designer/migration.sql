CREATE TYPE "JerseySize" AS ENUM ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL');
CREATE TYPE "JerseyPattern" AS ENUM ('SOLID', 'STRIPES', 'DIAGONAL', 'CHEVRON', 'GEOMETRIC', 'CAMO');
CREATE TYPE "JerseyCollar" AS ENUM ('CREW', 'V_NECK', 'POLO');
CREATE TYPE "JerseySleeve" AS ENUM ('SHORT', 'LONG');
CREATE TYPE "JerseyDesignStatus" AS ENUM ('DRAFT', 'SUBMITTED');
CREATE TYPE "JerseyLogoPlacement" AS ENUM ('FRONT_CHEST', 'LEFT_SLEEVE', 'RIGHT_SLEEVE', 'UPPER_BACK', 'LOWER_BACK');

CREATE TABLE "JerseyDesign" (
    "id" TEXT NOT NULL,
    "status" "JerseyDesignStatus" NOT NULL DEFAULT 'DRAFT',
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "jerseyNumber" INTEGER NOT NULL,
    "teamName" TEXT NOT NULL,
    "size" "JerseySize" NOT NULL,
    "primaryColor" TEXT NOT NULL,
    "secondaryColor" TEXT NOT NULL,
    "pattern" "JerseyPattern" NOT NULL,
    "collar" "JerseyCollar" NOT NULL,
    "sleeve" "JerseySleeve" NOT NULL,
    "baseImage" BYTEA NOT NULL,
    "baseImageType" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JerseyDesign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JerseySponsorLogo" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "sponsorName" TEXT NOT NULL,
    "placement" "JerseyLogoPlacement" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JerseySponsorLogo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JerseyDesign_status_createdAt_idx" ON "JerseyDesign"("status", "createdAt");
CREATE INDEX "JerseySponsorLogo_designId_createdAt_idx" ON "JerseySponsorLogo"("designId", "createdAt");

ALTER TABLE "JerseySponsorLogo"
  ADD CONSTRAINT "JerseySponsorLogo_designId_fkey"
  FOREIGN KEY ("designId") REFERENCES "JerseyDesign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
