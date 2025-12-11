import express from 'express';
import { injectable } from 'tsyringe';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

import Config from '~/configs';
import { initDB, initMigration } from '~/shared/infra/db/config/config';
import { initModels } from '~/shared/infra/db/models/models';
import registerApplicationMiddlewares from '~/shared/infra/http/middleware';
import registerApplicationRouters from '~/shared/infra/http/controller';
import { subscriptionExpiryQueue } from '~/shared/infra/queue';

@injectable()
export class HttpServer {
  constructor() {
    this.init();
  }

  private async init() {
    await initDB();
    await initMigration();
    await initModels();
  }

  public async startServer() {
    const app = express();

    await registerApplicationMiddlewares(app);
    await registerApplicationRouters(app);

    app.listen(Config.APP_PORT, () => {
      console.log(`Server available at http://localhost:${Config.APP_PORT}`);
    });
  }
}
