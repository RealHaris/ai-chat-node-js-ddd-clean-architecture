import { injectable, inject } from 'tsyringe';
import { IUseCase } from 'types-ddd';

import { UserReadRepository } from '~/modules/user/infra/persistence/repository/read';
import type { IUserGetAllRepository } from '~/modules/user/domain/interface/repository';

@injectable()
export class UserGetAllUseCase implements IUseCase<unknown, any[]> {
  constructor(
    @inject(UserReadRepository) private repository: IUserGetAllRepository
  ) {}

  async execute(): Promise<any[]> {
    const users = await this.repository.getAll();
    return users;
  }
}
