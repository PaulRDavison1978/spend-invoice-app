-- CreateTable
CREATE TABLE "budgets" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "function_id" INTEGER NOT NULL,
    "created_by_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add budget_id to budget_line_items (nullable initially for existing rows)
ALTER TABLE "budget_line_items" ADD COLUMN "budget_id" INTEGER;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_function_id_fkey" FOREIGN KEY ("function_id") REFERENCES "functions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_line_items" ADD CONSTRAINT "budget_line_items_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add budget permissions
INSERT INTO "permissions" ("key", "description") VALUES
  ('budget.manage_all', 'Create, edit, and submit budgets for any function/department'),
  ('budget.manage_own', 'Create, edit, and submit budgets for functions where you are the approver')
ON CONFLICT ("key") DO NOTHING;
