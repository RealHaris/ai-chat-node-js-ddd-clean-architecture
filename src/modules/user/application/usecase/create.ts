import { inject, injectable } from 'tsyringe';
import { IUseCase, Result } from 'types-ddd';
import { fromZodError } from 'zod-validation-error';

import { User as UserModel } from '~/shared/infra/db/types';
import {
  CreateUserDTO,
  CreateUserDTOSchema,
} from '~/modules/user/application/dto/dto';
import { User } from '~/modules/user/domain/entity/user';
import { UserAdded } from '~/modules/user/domain/event/user_added';
import { UserReadRepository } from '~/modules/user/infra/persistence/repository/read';
import { UserWriteRepository } from '~/modules/user/infra/persistence/repository/write';

import type { IUserCreateRepository } from '~/modules/user/domain/interface/repository';

import { ValidationError } from '~/shared/infra/error';

@injectable()
export class UserCreateUseCase implements IUseCase<
  CreateUserDTO,
  Result<UserModel, string>
> {
  constructor(
    @inject(UserReadRepository)
    private userReadRepository: UserReadRepository,
    @inject(UserWriteRepository)
    private userWriteRepository: IUserCreateRepository
  ) {}

  async execute(dto: CreateUserDTO): Promise<Result<UserModel, string>> {
    const schema = CreateUserDTOSchema.safeParse(dto);

    const isValidProps = schema.success;
    if (!isValidProps) {
      const validationError = fromZodError(schema.error);
      return Result.fail(validationError.toString());
    }

    // Check if user with the same email already exists
    const existingUser = await this.userReadRepository.firstAny({
      email: dto.email,
    });

    if (existingUser) {
      throw new ValidationError(
        'duplicate_user',
        'A user with that email already exists'
      );
    }

    const user = User.create({
      email: dto.email,
      password: dto.password,
      phone: dto.phone || undefined,
    });

    // Dispatched event
    user.value().dispatchEvent(UserAdded.NAME);

    const createdUser = await this.userWriteRepository.save(user.value());

    return Result.Ok(createdUser);
  }
}
