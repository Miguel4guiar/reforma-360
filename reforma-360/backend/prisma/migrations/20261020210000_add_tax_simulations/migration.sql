CREATE TABLE "TaxSimulation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "results" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TaxSimulation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaxSimulation_organizationId_createdAt_idx"
ON "TaxSimulation"("organizationId", "createdAt");

ALTER TABLE "TaxSimulation"
ADD CONSTRAINT "TaxSimulation_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
