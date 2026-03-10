-- DropIndex
DROP INDEX "invoice_monthly_costs_invoice_id_month_key";

-- CreateIndex
CREATE UNIQUE INDEX "invoice_monthly_costs_invoice_id_year_month_key" ON "invoice_monthly_costs"("invoice_id", "year_month");
