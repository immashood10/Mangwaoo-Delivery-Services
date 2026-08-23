-- CreateEnum
CREATE TYPE "SellerType" AS ENUM ('MART', 'GULPLAZA_OWNER', 'WHOLESALER');

-- AlterTable
ALTER TABLE "Seller" ADD COLUMN     "sellerType" "SellerType" NOT NULL DEFAULT 'MART';

-- CreateTable
CREATE TABLE "GulplazaCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,

    CONSTRAINT "GulplazaCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GulplazaProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(65,30) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sellerId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "GulplazaProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GulplazaOrder" (
    "id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "addressId" TEXT NOT NULL,

    CONSTRAINT "GulplazaOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GulplazaOrderItem" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "GulplazaOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GulplazaPayment" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderId" TEXT NOT NULL,

    CONSTRAINT "GulplazaPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GulplazaCategory_name_key" ON "GulplazaCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "GulplazaPayment_orderId_key" ON "GulplazaPayment"("orderId");

-- AddForeignKey
ALTER TABLE "GulplazaProduct" ADD CONSTRAINT "GulplazaProduct_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GulplazaProduct" ADD CONSTRAINT "GulplazaProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "GulplazaCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GulplazaOrder" ADD CONSTRAINT "GulplazaOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GulplazaOrder" ADD CONSTRAINT "GulplazaOrder_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GulplazaOrder" ADD CONSTRAINT "GulplazaOrder_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GulplazaOrderItem" ADD CONSTRAINT "GulplazaOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "GulplazaOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GulplazaOrderItem" ADD CONSTRAINT "GulplazaOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "GulplazaProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GulplazaPayment" ADD CONSTRAINT "GulplazaPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "GulplazaOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
