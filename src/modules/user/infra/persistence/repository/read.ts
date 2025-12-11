import { singleton } from 'tsyringe';

import { IUserReadRepository } from '~/modules/user/domain/interface/repository';
import { db } from '~/shared/infra/db/config/config';
import { users } from '~/shared/infra/db/schemas/users';
import { BaseReadRepository } from '~/shared/infra/persistence/repository/read';

@singleton()
export class UserReadRepository
  extends BaseReadRepository<typeof users>
  implements IUserReadRepository
{
  constructor() {
    super(users, db);
  }

  async getAll(): Promise<any[]> {
    return super.getAll();
  }

  async getByUserUuid(userUuid: string): Promise<any> {
    return super.get(userUuid);
  }

  // Additional method for firstAny (used in create usecase)
  async firstAny(whereClause: Record<string, any> = {}): Promise<any | null> {
    return super.firstAny(whereClause);
  }
}
