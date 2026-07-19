-- CreateTable
CREATE TABLE "quick_sales" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentMethod" "PaymentMethod",
    "serviceId" TEXT,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quick_sales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quick_sales_date_idx" ON "quick_sales"("date");

-- AddForeignKey
ALTER TABLE "quick_sales" ADD CONSTRAINT "quick_sales_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
