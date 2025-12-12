import { singleton } from 'tsyringe';

import { IUserReadRepository } from '~/modules/user/domain/interface/repository';
import { db } from '~/shared/infra/db/config/config';
import { users } from '~/shared/infra/db/schemas/users';
import { User } from '~/shared/infra/db/types';
import { BaseReadRepository } from '~/shared/infra/persistence/repository/read';

@singleton()
export class UserReadRepository
  extends BaseReadRepository<typeof users>
  implements IUserReadRepository
{
  constructor() {
    super(users, db);
  }

  async getAll(): Promise<User[]> {
    return super.getAll();
  }

  async getByUserUuid(userUuid: string): Promise<User> {
    return super.get(userUuid);
  }

  // Additional method for firstAny (used in create usecase)
  async firstAny(whereClause: Record<string, unknown> = {}): Promise<User | null> {
    return super.firstAny(whereClause);
  }
}
