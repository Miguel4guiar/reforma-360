import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Ativar CORS para permitir que a Vercel (e o localhost) comuniquem com a API
  app.enableCors({
    origin: [process.env.FRONTEND_URL || 'http://localhost:3000'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Prefixo global (garante que todas as rotas comecem por /api)
  app.setGlobalPrefix('api'); 

  await app.listen(process.env.PORT || 3001);
}
bootstrap();