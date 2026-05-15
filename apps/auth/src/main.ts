import { NestFactory } from '@nestjs/core';
import { NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import fastifyCors from '@fastify/cors';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './http-exception.filter.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: process.env.NODE_ENV !== 'production' }),
  );

  await app.register(fastifyCors, {
    origin: process.env.CORS_ORIGINS?.split(',').filter(Boolean) ?? false,
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const port = parseInt(process.env.AUTH_PORT ?? '3001', 10);
  await app.listen(port, '0.0.0.0');
  console.log(`[auth] HTTP server listening on port ${port}`);
}

bootstrap();
