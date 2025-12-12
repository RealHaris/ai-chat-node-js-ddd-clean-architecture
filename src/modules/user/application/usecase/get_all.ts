import { injectable, inject } from 'tsyringe';
import { IUseCase, Result } from 'types-ddd';

import { UserReadRepository } from '~/modules/user/infra/persistence/repository/read';
import type { IUserGetAllRepository } from '~/modules/user/domain/interface/repository';
import { User as UserModel } from '~/shared/infra/db/types';

@injectable()
export class UserGetAllUseCase implements IUseCase<unknown, Result<UserModel[]>> {
  constructor(
    @inject(UserReadRepository) private repository: IUserGetAllRepository
  ) {}

  async execute(): Promise<Result<UserModel[]>> {
    const users = await this.repository.getAll();
    return Result.Ok(users);
  }
}
