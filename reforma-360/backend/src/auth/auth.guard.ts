import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization as string | undefined;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Faça login para continuar.');
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; email: string }> (header.slice(7));
      if (!payload.sub) throw new Error('Token sem usuário');
      request.user = { id: payload.sub, email: payload.email };
      return true;
    } catch { throw new UnauthorizedException('Sessão inválida ou expirada. Entre novamente.'); }
  }
}
