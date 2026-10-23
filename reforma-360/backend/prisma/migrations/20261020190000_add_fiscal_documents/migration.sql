CREATE TABLE "FiscalDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "accessKey" TEXT,
    "documentNumber" TEXT,
    "series" TEXT,
    "documentType" TEXT NOT NULL DEFAULT 'NFE',
    "issuerName" TEXT,
    "issuerTaxId" TEXT,
    "recipientName" TEXT,
    "recipientTaxId" TEXT,
    "issuedAt" TIMESTAMP(3),
    "totalAmount" DECIMAL(18,2),
    "status" TEXT NOT NULL DEFAULT 'PROCESSED',
    "warnings" JSONB,
    "items" JSONB,
    "rawXml" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FiscalDocument_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FiscalDocument_organizationId_accessKey_key" ON "FiscalDocument"("organizationId", "accessKey");
CREATE INDEX "FiscalDocument_organizationId_createdAt_idx" ON "FiscalDocument"("organizationId", "createdAt");
CREATE INDEX "FiscalDocument_organizationId_status_idx" ON "FiscalDocument"("organizationId", "status");
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
