import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TaxSimulationsController } from './tax-simulations.controller';
import { TaxSimulationsService } from './tax-simulations.service';

@Module({
  imports: [AuthModule],
  controllers: [TaxSimulationsController],
  providers: [TaxSimulationsService],
})
export class TaxSimulationsModule {}
