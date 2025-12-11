import express from 'express';

import publicRouter from '~/shared/infra/http/controller/public/';

const registerApplicationRouters = async (app: express.Application) => {
  app.use(publicRouter);
};

export default registerApplicationRouters;
