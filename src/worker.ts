import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module.js';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
}
try {
  await bootstrap();
  console.log('Worker is running');
} catch (err) {
  console.error('Error starting worker:', err);
  process.exit(1);
}
