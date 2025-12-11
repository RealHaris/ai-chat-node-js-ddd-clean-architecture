import express from 'express';
import { inject, injectable } from 'tsyringe';

import { UserCreateUseCase } from '~/modules/user/application/usecase/create';
import { UserGetUseCase } from '~/modules/user/application/usecase/get';
import { UserGetAllUseCase } from '~/modules/user/application/usecase/get_all';
import {
  GetAllResponse,
  GetAllResponseSchema,
} from '~/modules/user/infra/http/contract/api';
import HttpStatus from '~/shared/common/enums/http_status';
import { asyncLocalStorage } from '~/shared/infra/http/store';
import { BaseController } from '~/shared/infra/http/utils/base_controller';

@injectable()
export class UserController extends BaseController {
  private router: express.Router;

  constructor(
    @inject(UserGetAllUseCase) private userGetAllUseCase: UserGetAllUseCase,
    @inject(UserGetUseCase) private userGetUseCase: UserGetUseCase,
    @inject(UserCreateUseCase) private userCreateUseCase: UserCreateUseCase
  ) {
    super();
    this.router = express.Router();
  }

  register() {
    this.router.get('/', this.getAll.bind(this));
    this.router.post('/', this.create.bind(this));

    // resolve :userUuid
    this.router.use(
      '/:userUuid',
      async (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
      ) => {
        if (!req.params.userUuid) {
          return next();
        }

        const userUuid = req.params.userUuid;
        const user = await this.userGetUseCase.execute(userUuid);

        const currentStore = asyncLocalStorage.get() || { method: '', url: '' };
        await asyncLocalStorage.run(
          {
            ...currentStore,
            user,
          },
          async () => {
            next();
          }
        );
      }
    );

    this.router.get('/:userId', this.get.bind(this));

    return this.router;
  }

  getAll = async (req: express.Request, res: express.Response) => {
    const users = await this.userGetAllUseCase.execute();

    res.status(HttpStatus.OK).json(
      this.generateResponse<GetAllResponse>(GetAllResponseSchema, {
        users,
      })
    );
  };

  get = async (req: express.Request, res: express.Response) => {
    try {
      const store = asyncLocalStorage.get();
      const user = store?.user;

      if (!user) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          error: 'User not authenticated',
        });
        return;
      }

      res.status(HttpStatus.OK).json({
        user,
      });
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'An error occurred while retrieving the user.',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  create = async (req: express.Request, res: express.Response) => {
    try {
      const payload = req.body;
      const useCase = await this.userCreateUseCase.execute(payload);

      if (useCase.isFail()) {
        res.status(HttpStatus.BAD_REQUEST).json({
          error: useCase.error(),
        });

        return;
      }

      res.status(HttpStatus.OK).json({
        user: useCase.value(),
      });
    } catch (error) {
      console.error('Error creating user:', error);

      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'An error occurred while creating the user.',
      });
    }
  };
}
