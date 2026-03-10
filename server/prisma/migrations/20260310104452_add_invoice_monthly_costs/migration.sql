/*
  Warnings:

  - You are about to drop the column `cost_allocation` on the `invoices` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "invoices" DROP COLUMN "cost_allocation";

-- CreateTable
CREATE TABLE "invoice_monthly_costs" (
    "id" SERIAL NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "year_month" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_monthly_costs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoice_monthly_costs_invoice_id_month_key" ON "invoice_monthly_costs"("invoice_id", "month");

-- AddForeignKey
ALTER TABLE "invoice_monthly_costs" ADD CONSTRAINT "invoice_monthly_costs_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
