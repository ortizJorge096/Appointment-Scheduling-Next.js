/*
  Warnings:

  - A unique constraint covering the columns `[phoneNormalized]` on the table `clients` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "phoneNormalized" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "clients_phoneNormalized_key" ON "clients"("phoneNormalized");
