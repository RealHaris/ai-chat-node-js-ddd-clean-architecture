import express from 'express';

import { useLogger } from '~/shared/packages/logger/logger';

const expressLogger = async (
  req: express.Request & { startTime?: number },
  res: express.Response,
  next: express.NextFunction
) => {
  const logger = useLogger('Express Server');

  const start = Date.now();

  logger.log(req.method, req.originalUrl);

  // Store start time for error logging
  req.startTime = start;

  try {
    await next();
  } catch (err) {
    // log uncaught downstream errors
    logger.error([start, err], `${req.method} ${req.originalUrl}`);
    throw err;
  }
};

export default expressLogger;
