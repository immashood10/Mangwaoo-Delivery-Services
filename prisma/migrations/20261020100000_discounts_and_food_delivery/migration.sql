-- Coupons the admin makes (Admin > Discount) and the food delivery fee that is worked out from the distance.
CREATE TYPE "CouponScope" AS ENUM ('ALL', 'FOOD', 'MART');

ALTER TABLE "Coupon" ADD COLUMN "description" TEXT;
ALTER TABLE "Coupon" ADD COLUMN "maxDiscountAmount" DECIMAL(65,30);
ALTER TABLE "Coupon" ADD COLUMN "minOrderAmount" DECIMAL(65,30);
ALTER TABLE "Coupon" ADD COLUMN "appliesTo" "CouponScope" NOT NULL DEFAULT 'ALL';
ALTER TABLE "Coupon" ADD COLUMN "onePerCustomer" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Coupon" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Coupon" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- One row per checkout that used a coupon.
CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CouponRedemption_couponId_customerId_idx" ON "CouponRedemption"("couponId", "customerId");

ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- What each order was reduced by, and (food only) the delivery fee charged on top.
ALTER TABLE "Order" ADD COLUMN "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "redemptionId" TEXT;
ALTER TABLE "Order" ADD CONSTRAINT "Order_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "CouponRedemption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GulplazaOrder" ADD COLUMN "deliveryFee" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "GulplazaOrder" ADD COLUMN "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "GulplazaOrder" ADD COLUMN "couponId" TEXT;
ALTER TABLE "GulplazaOrder" ADD COLUMN "redemptionId" TEXT;
ALTER TABLE "GulplazaOrder" ADD CONSTRAINT "GulplazaOrder_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GulplazaOrder" ADD CONSTRAINT "GulplazaOrder_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "CouponRedemption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
