-- Reforma 360 - Checklist de adequação tributária
-- Migration aditiva; não apaga nem recria dados existentes.
CREATE TYPE "ChecklistStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "ChecklistPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "companyId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GERAL',
    "status" "ChecklistStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "ChecklistPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "responsible" TEXT,
    "evidenceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChecklistItem_organizationId_status_idx" ON "ChecklistItem"("organizationId", "status");
CREATE INDEX "ChecklistItem_organizationId_dueDate_idx" ON "ChecklistItem"("organizationId", "dueDate");
CREATE INDEX "ChecklistItem_companyId_idx" ON "ChecklistItem"("companyId");

ALTER TABLE "ChecklistItem"
  ADD CONSTRAINT "ChecklistItem_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChecklistItem"
  ADD CONSTRAINT "ChecklistItem_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
