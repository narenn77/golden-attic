-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "country" TEXT,
ADD COLUMN     "year" INTEGER;

-- CreateIndex
CREATE INDEX "Listing_country_idx" ON "Listing"("country");

-- CreateIndex
CREATE INDEX "Listing_year_idx" ON "Listing"("year");
