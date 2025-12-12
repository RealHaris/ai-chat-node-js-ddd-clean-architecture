import express from 'express';
import multer from 'multer';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

import context from '~/shared/infra/http/middleware/context';
import corsMiddleware from '~/shared/infra/http/middleware/cors';
import logger from '~/shared/infra/http/middleware/logger';
import security from '~/shared/infra/http/middleware/security';

const registerApplicationMiddlewares = async (app: express.Application) => {
  // Body parsing middleware (replaces koa-better-body)
  const upload = multer();

  // Apply middleware in the correct order
  app.use(context);
  app.use(security);
  app.use(upload.any()); // Parse multipart/form-data
  app.use(express.json()); // Parse application/json
  app.use(express.urlencoded({ extended: true })); // Parse application/x-www-form-urlencoded
  app.use(corsMiddleware);
  app.use(logger);

  // Request ID middleware
  app.use(
    (
      req: express.Request & { requestId?: string },
      res: express.Response,
      next: express.NextFunction
    ) => {
      const reqId = `${os.hostname}-${uuidv4()}`;
      res.setHeader('App-X-RequestId', reqId);
      req.requestId = reqId;
      next();
    }
  );
};

export default registerApplicationMiddlewares;
