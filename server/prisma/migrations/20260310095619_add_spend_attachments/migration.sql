-- CreateTable
CREATE TABLE "spend_attachments" (
    "id" SERIAL NOT NULL,
    "spend_approval_id" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT,
    "file_url" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spend_attachments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "spend_attachments" ADD CONSTRAINT "spend_attachments_spend_approval_id_fkey" FOREIGN KEY ("spend_approval_id") REFERENCES "spend_approvals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
