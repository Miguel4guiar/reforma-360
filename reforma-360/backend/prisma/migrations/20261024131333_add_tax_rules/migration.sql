-- CreateTable
CREATE TABLE "StateTaxRate" (
    "id" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "ibsRate" DECIMAL(5,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StateTaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NcmRule" (
    "id" TEXT NOT NULL,
    "ncmPrefix" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reductionPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "isExempt" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NcmRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FederalTaxRate" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "cbsRate" DECIMAL(5,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FederalTaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StateTaxRate_uf_key" ON "StateTaxRate"("uf");

-- CreateIndex
CREATE INDEX "StateTaxRate_uf_idx" ON "StateTaxRate"("uf");

-- CreateIndex
CREATE UNIQUE INDEX "NcmRule_ncmPrefix_key" ON "NcmRule"("ncmPrefix");

-- CreateIndex
CREATE INDEX "NcmRule_ncmPrefix_idx" ON "NcmRule"("ncmPrefix");

-- CreateIndex
CREATE UNIQUE INDEX "FederalTaxRate_year_key" ON "FederalTaxRate"("year");
