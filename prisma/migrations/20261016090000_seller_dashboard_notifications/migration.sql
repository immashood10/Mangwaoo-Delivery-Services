-- Seller dashboard notifications: what happened, and which dashboard page shows it.
CREATE TYPE "NotificationType" AS ENUM ('CART', 'ORDER', 'MESSAGE', 'LIKE', 'ACCOUNT');

ALTER TABLE "Notification" ADD COLUMN "type" "NotificationType" NOT NULL DEFAULT 'ACCOUNT',
ADD COLUMN "href" TEXT,
ADD COLUMN "refId" TEXT;

ALTER TABLE "Notification" ALTER COLUMN "type" DROP DEFAULT;

CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- Notifications go away with their account.
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_userId_fkey";
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sellers can remove a pending-cart entry or a finished order from their own dashboard.
ALTER TABLE "CartItem" ADD COLUMN "dismissedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "sellerHidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GulplazaOrder" ADD COLUMN "sellerHidden" BOOLEAN NOT NULL DEFAULT false;
