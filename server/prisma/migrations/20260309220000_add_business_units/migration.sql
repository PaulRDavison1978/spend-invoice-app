-- CreateTable
CREATE TABLE "business_units" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "business_units_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_units_name_key" ON "business_units"("name");
