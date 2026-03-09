-- CreateTable
CREATE TABLE "budget_line_items" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "business_unit" TEXT,
    "service_category" TEXT,
    "licence" TEXT NOT NULL,
    "project" TEXT,
    "cost_centre" TEXT,
    "comments" TEXT,
    "region" TEXT,
    "vendor" TEXT,
    "contract_end_date" TEXT,
    "contract_value" DECIMAL(12,2),
    "currency" TEXT,
    "eur_annual" DECIMAL(12,2),
    "monthly_budget" JSONB,
    "spend_approval_id" INTEGER,

    CONSTRAINT "budget_line_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "budget_line_items" ADD CONSTRAINT "budget_line_items_spend_approval_id_fkey" FOREIGN KEY ("spend_approval_id") REFERENCES "spend_approvals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
