import 'reflect-metadata';
import { startServer } from './app';

async function bootstrap() {
  await startServer();
}

void bootstrap();
