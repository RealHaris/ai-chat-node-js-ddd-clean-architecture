import express from 'express';
import { inject, injectable } from 'tsyringe';

import { QuotaService } from '~/modules/subscription/application/service/quota.service';
import { CancelSubscriptionUseCase } from '~/modules/subscription/application/usecase/cancel';
import { GetUserSubscriptionsUseCase } from '~/modules/subscription/application/usecase/get_user_subscriptions';
import { SubscribeUseCase } from '~/modules/subscription/application/usecase/subscribe';
import { ToggleAutoRenewalUseCase } from '~/modules/subscription/application/usecase/toggle_auto_renewal';
import HttpStatus from '~/shared/common/enums/http_status';
import {
  AuthenticatedRequest,
  authMiddleware,
} from '~/shared/infra/http/middleware/auth';
import { BaseController } from '~/shared/infra/http/utils/base_controller';

@injectable()
export class SubscriptionController extends BaseController {
  private router: express.Router;

  constructor(
    @inject(SubscribeUseCase)
    private subscribeUseCase: SubscribeUseCase,
    @inject(CancelSubscriptionUseCase)
    private cancelSubscriptionUseCase: CancelSubscriptionUseCase,
    @inject(ToggleAutoRenewalUseCase)
    private toggleAutoRenewalUseCase: ToggleAutoRenewalUseCase,
    @inject(GetUserSubscriptionsUseCase)
    private getUserSubscriptionsUseCase: GetUserSubscriptionsUseCase,
    @inject(QuotaService)
    private quotaService: QuotaService
  ) {
    super();
    this.router = express.Router();
  }

  register() {
    // All routes require authentication
    this.router.use(authMiddleware);

    // Get user's subscriptions
    this.router.get('/', this.getSubscriptions.bind(this));

    // Get user's quota info
    this.router.get('/quota', this.getQuotaInfo.bind(this));

    // Subscribe to a bundle tier
    this.router.post('/', this.subscribe.bind(this));

    // Toggle auto-renewal
    this.router.patch(
      '/:subscriptionId/auto-renewal',
      this.toggleAutoRenewal.bind(this)
    );

    // Cancel subscription
    this.router.post('/:subscriptionId/cancel', this.cancel.bind(this));

    return this.router;
  }

  getSubscriptions = async (
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

      const activeOnly = req.query.active === 'true';

      const result = await this.getUserSubscriptionsUseCase.execute({
        userId: req.user.id,
        activeOnly,
      });

      if (result.isFail()) {
        res.status(HttpStatus.BAD_REQUEST).json({
          error: result.error(),
        });
        return;
      }

      res.status(HttpStatus.OK).json({
        data: result.value(),
      });
    } catch (error: unknown) {
      console.error('Get subscriptions error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to retrieve subscriptions',
      });
    }
  };

  getQuotaInfo = async (
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

      const quotaInfo = await this.quotaService.getQuotaInfo(req.user.id);

      res.status(HttpStatus.OK).json({
        data: quotaInfo,
      });
    } catch (error: unknown) {
      console.error('Get quota info error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to retrieve quota information',
      });
    }
  };

  subscribe = async (
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

      const result = await this.subscribeUseCase.execute({
        userId: req.user.id,
        data: req.body,
      });

      if (result.isFail()) {
        res.status(HttpStatus.BAD_REQUEST).json({
          error: result.error(),
        });
        return;
      }

      res.status(HttpStatus.CREATED).json({
        message: 'Subscription created successfully',
        data: result.value(),
      });
    } catch (error: unknown) {
      const errorName = error instanceof Error ? error.name : 'Error';

      if (errorName === 'NotFoundError') {
        res.status(HttpStatus.NOT_FOUND).json({
          error: error instanceof Error ? error.message : 'Not found',
        });
        return;
      }

      if (errorName === 'ValidationError') {
        res.status(HttpStatus.BAD_REQUEST).json({
          error: error instanceof Error ? error.message : 'Validation failed',
        });
        return;
      }

      console.error('Subscribe error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to create subscription',
      });
    }
  };

  toggleAutoRenewal = async (
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

      const { subscriptionId } = req.params;

      const result = await this.toggleAutoRenewalUseCase.execute({
        userId: req.user.id,
        data: { subscriptionId },
      });

      if (result.isFail()) {
        res.status(HttpStatus.BAD_REQUEST).json({
          error: result.error(),
        });
        return;
      }

      const subscription = result.value();

      res.status(HttpStatus.OK).json({
        message: `Auto-renewal ${subscription.autoRenewal ? 'enabled' : 'disabled'}`,
        data: subscription,
      });
    } catch (error: unknown) {
      const errorName = error instanceof Error ? error.name : 'Error';

      if (errorName === 'NotFoundError') {
        res.status(HttpStatus.NOT_FOUND).json({
          error: error instanceof Error ? error.message : 'Not found',
        });
        return;
      }

      if (errorName === 'ForbiddenError') {
        res.status(HttpStatus.FORBIDDEN).json({
          error: error instanceof Error ? error.message : 'Forbidden',
        });
        return;
      }

      console.error('Toggle auto-renewal error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to toggle auto-renewal',
      });
    }
  };

  cancel = async (
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

      const { subscriptionId } = req.params;

      const result = await this.cancelSubscriptionUseCase.execute({
        userId: req.user.id,
        data: { subscriptionId },
      });

      if (result.isFail()) {
        res.status(HttpStatus.BAD_REQUEST).json({
          error: result.error(),
        });
        return;
      }

      res.status(HttpStatus.OK).json(result.value());
    } catch (error: unknown) {
      const errorName = error instanceof Error ? error.name : 'Error';

      if (errorName === 'NotFoundError') {
        res.status(HttpStatus.NOT_FOUND).json({
          error: error instanceof Error ? error.message : 'Not found',
        });
        return;
      }

      if (errorName === 'ForbiddenError') {
        res.status(HttpStatus.FORBIDDEN).json({
          error: error instanceof Error ? error.message : 'Forbidden',
        });
        return;
      }

      console.error('Cancel subscription error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to cancel subscription',
      });
    }
  };
}
