-- Live order tracking: when an order reached each step (the customer's tracking page shows them as a timeline), and when a
-- rider's last position was written (the page shows how fresh it is). Additive: every new column is nullable, the earlier code
-- never reads or writes them, and orders placed before this migration simply have no step times.

-- AlterTable
ALTER TABLE "GulplazaOrder" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "outForDeliveryAt" TIMESTAMP(3),
ADD COLUMN     "preparingAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "outForDeliveryAt" TIMESTAMP(3),
ADD COLUMN     "preparingAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Rider" ADD COLUMN     "locationUpdatedAt" TIMESTAMP(3);
