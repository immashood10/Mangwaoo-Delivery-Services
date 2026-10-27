-- Food dishes can be sold by weight (250 g, 375 g, 500 g, 750 g, 1 kg ...), each size with its own price.
-- Additive: the old code never reads or sets either column (a dish without sizes stays NULL).
ALTER TABLE "GulplazaProduct" ADD COLUMN "portions" JSONB;
ALTER TABLE "GulplazaOrderItem" ADD COLUMN "portionGrams" INTEGER;
