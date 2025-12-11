import express from 'express';
import { inject, injectable } from 'tsyringe';

import { CreateBundleTierUseCase } from '~/modules/bundle-tier/application/usecase/create';
import { DeleteBundleTierUseCase } from '~/modules/bundle-tier/application/usecase/delete';
import { GetBundleTierUseCase } from '~/modules/bundle-tier/application/usecase/get';
import { GetAllBundleTiersUseCase } from '~/modules/bundle-tier/application/usecase/get_all';
import { UpdateBundleTierUseCase } from '~/modules/bundle-tier/application/usecase/update';
import HttpStatus from '~/shared/common/enums/http_status';
import { adminMiddleware } from '~/shared/infra/http/middleware/admin';
import {
  AuthenticatedRequest,
  authMiddleware,
} from '~/shared/infra/http/middleware/auth';
import { BaseController } from '~/shared/infra/http/utils/base_controller';

@injectable()
export class BundleTierController extends BaseController {
  private router: express.Router;

  constructor(
    @inject(CreateBundleTierUseCase)
    private createBundleTierUseCase: CreateBundleTierUseCase,
    @inject(UpdateBundleTierUseCase)
    private updateBundleTierUseCase: UpdateBundleTierUseCase,
    @inject(DeleteBundleTierUseCase)
    private deleteBundleTierUseCase: DeleteBundleTierUseCase,
    @inject(GetBundleTierUseCase)
    private getBundleTierUseCase: GetBundleTierUseCase,
    @inject(GetAllBundleTiersUseCase)
    private getAllBundleTiersUseCase: GetAllBundleTiersUseCase
  ) {
    super();
    this.router = express.Router();
  }

  register() {
    // Public routes - Get all active bundle tiers (for customers to see available plans)
    this.router.get('/', this.getAll.bind(this));
    this.router.get('/:id', this.getById.bind(this));

    // Admin-only routes
    this.router.post(
      '/',
      authMiddleware,
      adminMiddleware,
      this.create.bind(this)
    );
    this.router.put(
      '/:id',
      authMiddleware,
      adminMiddleware,
      this.update.bind(this)
    );
    this.router.delete(
      '/:id',
      authMiddleware,
      adminMiddleware,
      this.delete.bind(this)
    );

    // Admin route to get all including inactive
    this.router.get(
      '/admin/all',
      authMiddleware,
      adminMiddleware,
      this.getAllAdmin.bind(this)
    );

    return this.router;
  }

  getAll = async (
    _req: express.Request,
    res: express.Response
  ): Promise<void> => {
    try {
      const result = await this.getAllBundleTiersUseCase.execute({
        includeInactive: false,
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
      console.error('Get all bundle tiers error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to retrieve bundle tiers',
      });
    }
  };

  getAllAdmin = async (
    _req: AuthenticatedRequest,
    res: express.Response
  ): Promise<void> => {
    try {
      const result = await this.getAllBundleTiersUseCase.execute({
        includeInactive: true,
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
      console.error('Get all bundle tiers (admin) error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to retrieve bundle tiers',
      });
    }
  };

  getById = async (
    req: express.Request,
    res: express.Response
  ): Promise<void> => {
    try {
      const { id } = req.params;

      const result = await this.getBundleTierUseCase.execute({ id });

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
      const errorName = error instanceof Error ? error.name : 'Error';

      if (errorName === 'NotFoundError') {
        res.status(HttpStatus.NOT_FOUND).json({
          error:
            error instanceof Error ? error.message : 'Bundle tier not found',
        });
        return;
      }

      console.error('Get bundle tier error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to retrieve bundle tier',
      });
    }
  };

  create = async (
    req: AuthenticatedRequest,
    res: express.Response
  ): Promise<void> => {
    try {
      const createdBy = req.user?.id;

      const result = await this.createBundleTierUseCase.execute(
        req.body,
        createdBy
      );

      if (result.isFail()) {
        res.status(HttpStatus.BAD_REQUEST).json({
          error: result.error(),
        });
        return;
      }

      res.status(HttpStatus.CREATED).json({
        message: 'Bundle tier created successfully',
        data: result.value(),
      });
    } catch (error: unknown) {
      const errorName = error instanceof Error ? error.name : 'Error';

      if (errorName === 'ValidationError') {
        res.status(HttpStatus.BAD_REQUEST).json({
          error: error instanceof Error ? error.message : 'Validation failed',
        });
        return;
      }

      console.error('Create bundle tier error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to create bundle tier',
      });
    }
  };

  update = async (
    req: AuthenticatedRequest,
    res: express.Response
  ): Promise<void> => {
    try {
      const { id } = req.params;

      const result = await this.updateBundleTierUseCase.execute({
        id,
        data: req.body,
      });

      if (result.isFail()) {
        res.status(HttpStatus.BAD_REQUEST).json({
          error: result.error(),
        });
        return;
      }

      res.status(HttpStatus.OK).json({
        message: 'Bundle tier updated successfully',
        data: result.value(),
      });
    } catch (error: unknown) {
      const errorName = error instanceof Error ? error.name : 'Error';

      if (errorName === 'NotFoundError') {
        res.status(HttpStatus.NOT_FOUND).json({
          error:
            error instanceof Error ? error.message : 'Bundle tier not found',
        });
        return;
      }

      if (errorName === 'ValidationError') {
        res.status(HttpStatus.BAD_REQUEST).json({
          error: error instanceof Error ? error.message : 'Validation failed',
        });
        return;
      }

      console.error('Update bundle tier error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to update bundle tier',
      });
    }
  };

  delete = async (
    req: AuthenticatedRequest,
    res: express.Response
  ): Promise<void> => {
    try {
      const { id } = req.params;

      const result = await this.deleteBundleTierUseCase.execute({ id });

      if (result.isFail()) {
        res.status(HttpStatus.BAD_REQUEST).json({
          error: result.error(),
        });
        return;
      }

      res.status(HttpStatus.OK).json({
        message: result.value().message,
      });
    } catch (error: unknown) {
      const errorName = error instanceof Error ? error.name : 'Error';

      if (errorName === 'NotFoundError') {
        res.status(HttpStatus.NOT_FOUND).json({
          error:
            error instanceof Error ? error.message : 'Bundle tier not found',
        });
        return;
      }

      console.error('Delete bundle tier error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to delete bundle tier',
      });
    }
  };
}
