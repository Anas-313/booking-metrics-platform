import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set global prefix for all routes
  app.setGlobalPrefix('api');

  const port = Number(process.env.PORT) ?? 3000;
  await app.listen(port).then(() => {
    console.log(`Server is running on http://localhost:${port}`);
    console.log(`API endpoints available at http://localhost:${port}/api`);
  });
}
bootstrap();
