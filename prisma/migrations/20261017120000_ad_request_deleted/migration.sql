-- An admin can delete an ended or declined ad request from the Ad Requests list. The row is kept (marked
-- with deletedAt) so a paid transaction id still can't be reused for another ad.
ALTER TABLE "ProductAd" ADD COLUMN "deletedAt" TIMESTAMP(3);
