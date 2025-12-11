import express from 'express';
import { inject, injectable } from 'tsyringe';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';

import { ChatMessageReadRepository } from '~/modules/chat/infra/persistence/repository/read';
import { QuotaService } from '~/modules/subscription/application/service/quota.service';
import { SubscriptionReadRepository } from '~/modules/subscription/infra/persistence/repository/read';
import { UserGetUseCase } from '~/modules/user/application/usecase/get';
import { UserGetAllUseCase } from '~/modules/user/application/usecase/get_all';
import { UserReadRepository } from '~/modules/user/infra/persistence/repository/read';
import { UserWriteRepository } from '~/modules/user/infra/persistence/repository/write';
import HttpStatus from '~/shared/common/enums/http_status';
import { adminMiddleware } from '~/shared/infra/http/middleware/admin';
import {
  AuthenticatedRequest,
  authMiddleware,
} from '~/shared/infra/http/middleware/auth';
import { BaseController } from '~/shared/infra/http/utils/base_controller';

// Update User DTO Schema
const UpdateUserDTOSchema = z.object({
  phone: z.string().max(20).nullish(),
});

@injectable()
export class UserController extends BaseController {
  private router: express.Router;

  constructor(
    @inject(UserGetAllUseCase) private userGetAllUseCase: UserGetAllUseCase,
    @inject(UserGetUseCase) private userGetUseCase: UserGetUseCase,
    @inject(UserReadRepository) private userReadRepository: UserReadRepository,
    @inject(UserWriteRepository)
    private userWriteRepository: UserWriteRepository,
    @inject(SubscriptionReadRepository)
    private subscriptionReadRepository: SubscriptionReadRepository,
    @inject(ChatMessageReadRepository)
    private chatMessageReadRepository: ChatMessageReadRepository,
    @inject(QuotaService) private quotaService: QuotaService
  ) {
    super();
    this.router = express.Router();
  }

  register() {
    // All user routes require authentication
    this.router.use(authMiddleware);

    // Get current user's profile
    this.router.get('/me', this.getCurrentUser.bind(this));

    // Update current user's profile
    this.router.patch('/me', this.updateCurrentUser.bind(this));

    // Admin-only routes
    this.router.get('/', adminMiddleware, this.getAll.bind(this));
    this.router.get(
      '/get-user-stats/:userId',
      adminMiddleware,
      this.getUserStats.bind(this)
    );
    this.router.get('/:userId', adminMiddleware, this.getById.bind(this));
    this.router.patch('/:userId', adminMiddleware, this.updateUser.bind(this));
    this.router.delete('/:userId', adminMiddleware, this.deleteUser.bind(this));

    return this.router;
  }

  /**
   * GET /users/me
   * Get current authenticated user's profile
   */
  getCurrentUser = async (
    req: AuthenticatedRequest,
    res: express.Response
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          error: 'User not authenticated',
        });
        return;
      }

      // Remove password from response
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _password, ...userWithoutPassword } = req.user;

      res.status(HttpStatus.OK).json({
        data: userWithoutPassword,
      });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to retrieve user profile',
      });
    }
  };

  /**
   * PATCH /users/me
   * Update current user's profile
   */
  updateCurrentUser = async (
    req: AuthenticatedRequest,
    res: express.Response
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          error: 'User not authenticated',
        });
        return;
      }

      const validation = UpdateUserDTOSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(HttpStatus.BAD_REQUEST).json({
          error: fromZodError(validation.error).toString(),
        });
        return;
      }

      const { phone } = validation.data;
      const updatedUser = await this.userWriteRepository.updatePhone(
        req.user.id,
        phone ?? null
      );

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _password, ...userWithoutPassword } = updatedUser;

      res.status(HttpStatus.OK).json({
        message: 'Profile updated successfully',
        data: userWithoutPassword,
      });
    } catch (error) {
      console.error('Update current user error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to update profile',
      });
    }
  };

  /**
   * GET /users
   * Admin-only: Get all users
   */
  getAll = async (
    _req: AuthenticatedRequest,
    res: express.Response
  ): Promise<void> => {
    try {
      const users = await this.userGetAllUseCase.execute();

      // Remove passwords from response
      const usersWithoutPassword = users.map(user => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });

      res.status(HttpStatus.OK).json({
        data: usersWithoutPassword,
      });
    } catch (error) {
      console.error('Get all users error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to retrieve users',
      });
    }
  };

  /**
   * GET /users/get-user-stats/:userId
   * Admin-only: Get comprehensive user statistics using Promise.allSettled
   */
  getUserStats = async (
    req: AuthenticatedRequest,
    res: express.Response
  ): Promise<void> => {
    try {
      const { userId } = req.params;

      // Fetch user first
      const user = await this.userReadRepository.getAny(userId);
      if (!user || user.deletedAt) {
        res.status(HttpStatus.NOT_FOUND).json({
          error: 'User not found',
        });
        return;
      }

      // Use Promise.allSettled to fetch all stats concurrently
      const [
        quotaResult,
        totalSubscriptionsResult,
        activeSubscriptionsResult,
        totalSpentResult,
        totalMessagesResult,
        completedMessagesResult,
        failedMessagesResult,
        subscriptionsResult,
      ] = await Promise.allSettled([
        this.quotaService.getQuotaInfo(userId),
        this.subscriptionReadRepository.countByUserId(userId),
        this.subscriptionReadRepository.countActiveByUserId(userId),
        this.subscriptionReadRepository.sumSpentByUserId(userId),
        this.chatMessageReadRepository.countByUserId(userId),
        this.chatMessageReadRepository.countByUserId(userId, 'completed'),
        this.chatMessageReadRepository.countByUserId(userId, 'failed'),
        this.subscriptionReadRepository.findByUserId(userId),
      ]);

      // Build stats object with error handling for each field
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _password, ...userWithoutPassword } = user;

      const stats = {
        user: userWithoutPassword,
        quota:
          quotaResult.status === 'fulfilled'
            ? quotaResult.value
            : { error: 'Failed to fetch quota' },
        subscriptions: {
          total:
            totalSubscriptionsResult.status === 'fulfilled'
              ? totalSubscriptionsResult.value
              : 0,
          active:
            activeSubscriptionsResult.status === 'fulfilled'
              ? activeSubscriptionsResult.value
              : 0,
          totalSpent:
            totalSpentResult.status === 'fulfilled'
              ? totalSpentResult.value
              : '0.00',
          list:
            subscriptionsResult.status === 'fulfilled'
              ? subscriptionsResult.value
              : [],
        },
        messages: {
          total:
            totalMessagesResult.status === 'fulfilled'
              ? totalMessagesResult.value
              : 0,
          completed:
            completedMessagesResult.status === 'fulfilled'
              ? completedMessagesResult.value
              : 0,
          failed:
            failedMessagesResult.status === 'fulfilled'
              ? failedMessagesResult.value
              : 0,
        },
      };

      res.status(HttpStatus.OK).json({
        data: stats,
      });
    } catch (error) {
      console.error('Get user stats error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to retrieve user stats',
      });
    }
  };

  /**
   * GET /users/:userId
   * Admin-only: Get user by ID
   */
  getById = async (
    req: AuthenticatedRequest,
    res: express.Response
  ): Promise<void> => {
    try {
      const { userId } = req.params;

      const user = await this.userGetUseCase.execute(userId);

      if (!user) {
        res.status(HttpStatus.NOT_FOUND).json({
          error: 'User not found',
        });
        return;
      }

      // Remove password from response
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _password, ...userWithoutPassword } = user;

      res.status(HttpStatus.OK).json({
        data: userWithoutPassword,
      });
    } catch (error) {
      const errorName = error instanceof Error ? error.name : 'Error';

      if (errorName === 'NotFoundError') {
        res.status(HttpStatus.NOT_FOUND).json({
          error: error instanceof Error ? error.message : 'User not found',
        });
        return;
      }

      console.error('Get user by ID error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to retrieve user',
      });
    }
  };

  /**
   * PATCH /users/:userId
   * Admin-only: Update user
   */
  updateUser = async (
    req: AuthenticatedRequest,
    res: express.Response
  ): Promise<void> => {
    try {
      const { userId } = req.params;

      // Check if user exists
      const user = await this.userReadRepository.getAny(userId);
      if (!user || user.deletedAt) {
        res.status(HttpStatus.NOT_FOUND).json({
          error: 'User not found',
        });
        return;
      }

      const validation = UpdateUserDTOSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(HttpStatus.BAD_REQUEST).json({
          error: fromZodError(validation.error).toString(),
        });
        return;
      }

      const { phone } = validation.data;
      const updatedUser = await this.userWriteRepository.updatePhone(
        userId,
        phone ?? null
      );

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _password, ...userWithoutPassword } = updatedUser;

      res.status(HttpStatus.OK).json({
        message: 'User updated successfully',
        data: userWithoutPassword,
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to update user',
      });
    }
  };

  /**
   * DELETE /users/:userId
   * Admin-only: Soft delete user
   */
  deleteUser = async (
    req: AuthenticatedRequest,
    res: express.Response
  ): Promise<void> => {
    try {
      const { userId } = req.params;

      // Check if user exists
      const user = await this.userReadRepository.getAny(userId);
      if (!user) {
        res.status(HttpStatus.NOT_FOUND).json({
          error: 'User not found',
        });
        return;
      }

      if (user.deletedAt) {
        res.status(HttpStatus.BAD_REQUEST).json({
          error: 'User is already deleted',
        });
        return;
      }

      // Prevent admin from deleting themselves
      if (req.user?.id === userId) {
        res.status(HttpStatus.BAD_REQUEST).json({
          error: 'Cannot delete your own account',
        });
        return;
      }

      await this.userWriteRepository.softDelete(userId);

      res.status(HttpStatus.OK).json({
        message: 'User deleted successfully',
      });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to delete user',
      });
    }
  };
}
