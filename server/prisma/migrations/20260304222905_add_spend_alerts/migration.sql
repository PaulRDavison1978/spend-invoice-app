-- CreateTable
CREATE TABLE "spend_alerts" (
    "id" SERIAL NOT NULL,
    "spend_approval_id" INTEGER NOT NULL,
    "threshold" TEXT NOT NULL,
    "total_invoiced" DECIMAL(12,2) NOT NULL,
    "approved_amount" DECIMAL(12,2) NOT NULL,
    "dismissed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spend_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "spend_alerts_spend_approval_id_threshold_key" ON "spend_alerts"("spend_approval_id", "threshold");

-- AddForeignKey
ALTER TABLE "spend_alerts" ADD CONSTRAINT "spend_alerts_spend_approval_id_fkey" FOREIGN KEY ("spend_approval_id") REFERENCES "spend_approvals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
