import express from 'express';
import { container } from 'tsyringe';

import { TokenService } from '~/modules/auth/application/service/token.service';
import { UserReadRepository } from '~/modules/user/infra/persistence/repository/read';
import HttpStatus from '~/shared/common/enums/http_status';
import { User } from '~/shared/infra/db/types';
import { asyncLocalStorage } from '~/shared/infra/http/store';

export interface AuthenticatedRequest extends express.Request {
  user?: User;
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(HttpStatus.UNAUTHORIZED).json({
        error: 'Authorization header missing or invalid',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const tokenService = container.resolve(TokenService);
    const payload = tokenService.verifyAccessToken(token);

    if (!payload) {
      res.status(HttpStatus.UNAUTHORIZED).json({
        error: 'Invalid or expired access token',
      });
      return;
    }

    // Get user from database
    const userReadRepository = container.resolve(UserReadRepository);
    const user = await userReadRepository.getAny(payload.userId);

    if (!user || user.deletedAt) {
      res.status(HttpStatus.UNAUTHORIZED).json({
        error: 'User not found or has been deactivated',
      });
      return;
    }

    // Attach user to request
    req.user = user;

    // Store user in async local storage for downstream use
    const currentStore = asyncLocalStorage.get() || { method: '', url: '' };
    asyncLocalStorage.run(
      {
        ...currentStore,
        user,
      },
      async () => {
        await Promise.resolve();
        next();
      }
    );
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: 'Authentication failed',
    });
  }
};
