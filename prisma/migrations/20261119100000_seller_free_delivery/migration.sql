-- Each food seller decides whether (and from which order amount) its orders get free delivery. null = no free delivery.
-- Until now every restaurant gave free delivery from Rs 200 automatically; after this migration none does until its owner opts in.
ALTER TABLE "Seller"
  ADD COLUMN "freeDeliveryMinOrder" INTEGER,
  ADD CONSTRAINT "Seller_freeDeliveryMinOrder_check" CHECK ("freeDeliveryMinOrder" IS NULL OR "freeDeliveryMinOrder" BETWEEN 1 AND 100000);
