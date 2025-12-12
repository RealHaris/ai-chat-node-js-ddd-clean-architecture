import { injectable, inject } from 'tsyringe';
import { IUseCase, Result } from 'types-ddd';

import { UserReadRepository } from '~/modules/user/infra/persistence/repository/read';
import type { IUserGetByIdRepository } from '~/modules/user/domain/interface/repository';
import { User as UserModel } from '~/shared/infra/db/types';

@injectable()
export class UserGetUseCase implements IUseCase<string, Result<UserModel>> {
  constructor(
    @inject(UserReadRepository) private repository: IUserGetByIdRepository
  ) {}

  async execute(userUuid: string): Promise<Result<UserModel>> {
    const user = await this.repository.getByUserUuid(userUuid);
    return Result.Ok(user);
  }
}
