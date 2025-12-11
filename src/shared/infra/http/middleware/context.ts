import express from 'express';
import { asyncLocalStorage } from '~/shared/infra/http/store';

const requestCtxMiddleware = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const store = {
    method: req.method,
    url: req.url,
  };

  await asyncLocalStorage.run(store, async () => {
    next();
  });
};

export default requestCtxMiddleware;
