import { singleton } from 'tsyringe';

import { IUserWriteRepository } from '~/modules/user/domain/interface/repository';
import { db } from '~/shared/infra/db/config/config';
import { users } from '~/shared/infra/db/schemas/users';
import { BaseWriteRepository } from '~/shared/infra/persistence/repository/write';

@singleton()
export class UserWriteRepository
  extends BaseWriteRepository<typeof users, any>
  implements IUserWriteRepository
{
  constructor() {
    super(users, db);
  }
}
