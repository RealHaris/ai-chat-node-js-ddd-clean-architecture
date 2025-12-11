import express from 'express';
import { injectable } from 'tsyringe';

import HttpStatus from '~/shared/common/enums/http_status';
import { BaseController } from '~/shared/infra/http/utils/base_controller';

@injectable()
export class CustomerController extends BaseController {
  private router: express.Router;

  constructor() {
    super();
    this.router = express.Router();
  }

  register() {
    this.router.post('/', this.create.bind(this));
    return this.router;
  }

  create = async (req: express.Request, res: express.Response) => {
    res.status(HttpStatus.OK).json({
      data: 'Created',
    });
  };
}
