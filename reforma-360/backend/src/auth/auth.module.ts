import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
@Module({ imports: [JwtModule.register({ secret: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('JWT_SECRET é obrigatório em produção'); })() : 'LOCAL_DEV_SECRET_CHANGE_BEFORE_DEPLOYMENT_360'), signOptions: { expiresIn: '8h' } })], controllers: [AuthController], providers: [AuthService, AuthGuard], exports: [AuthGuard, JwtModule] })
export class AuthModule {}
