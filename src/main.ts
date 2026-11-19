import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { ErroresFilter } from './infrastructure/rest/errores.filter';

async function bootstrap() {
  // Fuera de Docker las variables vienen de .env; dentro, de env_file.
  try {
    process.loadEnvFile();
  } catch {
    // sin .env: se usan las variables del entorno
  }

  const app = await NestFactory.create(AppModule.registrar(process.env));
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new ErroresFilter());

  const puerto = Number(process.env.PORT ?? 3005);
  await app.listen(puerto, '0.0.0.0');
  new Logger('Bootstrap').log(`erp-connector-service escuchando en :${puerto} (solo lectura del ERP)`);
}

void bootstrap();
