import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS para permitir peticiones del frontend en desarrollo
  app.enableCors();

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
