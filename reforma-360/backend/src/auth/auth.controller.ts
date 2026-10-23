import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly prisma: PrismaService) {}
  @Post('register') @ApiOperation({ summary: 'Cria usuário, organização e sessão' }) register(@Body() dto: RegisterDto) { return this.auth.register(dto); }
  @Post('login') @ApiOperation({ summary: 'Inicia sessão' }) login(@Body() dto: LoginDto) { return this.auth.login(dto); }
  @Get('me') @UseGuards(AuthGuard) @ApiBearerAuth() @ApiOperation({ summary: 'Retorna o usuário autenticado e suas organizações' })
  async me(@Req() req: Request & { user: { id: string; email: string } }) {
    const user = await this.prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, name: true, email: true } });
    if (!user) return { user: null, organizations: [] };
    const memberships = await this.prisma.membership.findMany({ where: { userId: user.id }, include: { organization: true }, orderBy: { createdAt: 'asc' } });
    return { user, organizations: memberships.map(m => m.organization) };
  }
}
