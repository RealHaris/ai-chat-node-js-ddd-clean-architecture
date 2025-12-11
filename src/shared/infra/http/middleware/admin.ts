import express from 'express';

import HttpStatus from '~/shared/common/enums/http_status';
import { AuthenticatedRequest } from '~/shared/infra/http/middleware/auth';

export const adminMiddleware = (
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
): void => {
  if (!req.user) {
    res.status(HttpStatus.UNAUTHORIZED).json({
      error: 'Authentication required',
    });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(HttpStatus.FORBIDDEN).json({
      error: 'Admin access required',
    });
    return;
  }

  next();
};
