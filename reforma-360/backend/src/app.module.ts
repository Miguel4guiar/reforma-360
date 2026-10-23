import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health.controller';
import { CompaniesModule } from './companies/companies.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { AuthModule } from './auth/auth.module';
import { ChecklistModule } from './checklist/checklist.module';
import { FiscalDocumentsModule } from './fiscal-documents/fiscal-documents.module';
import { TaxSimulationsModule } from './tax-simulations/tax-simulations.module';
@Module({ imports: [PrismaModule, AuthModule, CompaniesModule, OrganizationsModule, ChecklistModule, FiscalDocumentsModule, TaxSimulationsModule], controllers: [HealthController] })
export class AppModule {}
