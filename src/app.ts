import 'reflect-metadata';
import express from 'express';
import { container } from 'tsyringe';
import Config from '~/configs';
import { initDB, initMigration } from '~/shared/infra/db/config/config';
import { initModels } from '~/shared/infra/db/models/models';
import registerApplicationMiddlewares from '~/shared/infra/http/middleware';
import registerApplicationRouters from '~/shared/infra/http/controller';
import { testRedisConnection } from '~/shared/infra/redis/client';

export async function createApp() {
  await initDB();
  await initMigration();
  await initModels();

  const app = express();

  // Test Redis connection
  const redisConnected = await testRedisConnection();

  if (!redisConnected) {
    console.error('ERROR: Redis is not connected!');
    console.error(
      'Please ensure Redis is running and check your REDIS_HOST and REDIS_PORT settings.'
    );
    process.exit(1);
  }

  await registerApplicationMiddlewares(app);
  await registerApplicationRouters(app);

  return app;
}

export async function startServer() {
  const app = await createApp();
  
  app.listen(Config.APP_PORT, () => {
    console.log(`Server available at http://localhost:${Config.APP_PORT}`);
  });
}