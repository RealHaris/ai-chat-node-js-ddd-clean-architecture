import { inject, injectable } from 'tsyringe';
import { IUseCase, Result } from 'types-ddd';
import { fromZodError } from 'zod-validation-error';

import {
  Customer as CustomerModel,
  User as UserModel,
} from '~/shared/infra/db/types';

import Config from '~/configs';

import { Customer } from '~/modules/customer/domain/entity/customer';
import { CustomerWriteRepository } from '~/modules/customer/infra/persistence/repository/write';
import {
  CreateUserDTO,
  CreateUserDTOSchema,
} from '~/modules/user/application/dto/dto';
import { User } from '~/modules/user/domain/entity/user';
import { UserAdded } from '~/modules/user/domain/event/user_added';
import { UserReadRepository } from '~/modules/user/infra/persistence/repository/read';
import { UserWriteRepository } from '~/modules/user/infra/persistence/repository/write';
import { BaseWriteRepository } from '~/shared/infra/persistence/repository/write';

import type { IUserCreateRepository } from '~/modules/user/domain/interface/repository';

import { NotImplementedError, ValidationError } from '~/shared/infra/error';

@injectable()
export class UserCreateUseCase implements IUseCase<
  CreateUserDTO,
  Result<UserModel, string>
> {
  constructor(
    @inject(UserReadRepository)
    private userReadRepository: UserReadRepository,
    @inject(UserWriteRepository)
    private userWriteRepository: IUserCreateRepository,
    @inject(CustomerWriteRepository)
    private customerWriteRepository: CustomerWriteRepository
  ) {}

  async execute(
    dto: CreateUserDTO,
    isCreateForAdmin = false
  ): Promise<Result<UserModel, string>> {
    const schema = CreateUserDTOSchema.safeParse(dto);

    const isValidProps = schema.success;
    if (!isValidProps) {
      const validationError = fromZodError(schema.error);
      return Result.fail(validationError.toString());
    }

    // Check if user with the same email/phone already exists
    const existingUser = await this.userReadRepository.firstAny({
      email: dto.email,
      phone: dto.phone,
    });

    if (existingUser) {
      throw new ValidationError(
        'duplicate_customer',
        'A user with that email and phone already exists'
      );
    }

    return BaseWriteRepository.beginTransaction(async () => {
      const user = User.create({
        email: dto.email,
        password: dto.password,
        phone: dto.phone || undefined,
      });

      // Dispatched event
      user.value().dispatchEvent(UserAdded.NAME);

      const createdUser = await this.userWriteRepository.save(user.value());
      const createdUserId = createdUser.id;

      if (!isCreateForAdmin) {
        await this.createCustomer(createdUserId, dto);
      } else if (Config.APP_ENV !== 'production') {
        await this.createAdmin(createdUserId, dto);
      }

      return Result.Ok(createdUser);
    });
  }

  protected async createCustomer(
    userId: string,
    payload: any
  ): Promise<Result<CustomerModel>> {
    const customer = Customer.create({
      ...payload,
      userId,
    });
    const createdCustomer = await this.customerWriteRepository.save(
      customer.value()
    );
    return Result.Ok(createdCustomer);
  }

  protected async createAdmin(
    _userId: string,
    _payload: any
  ): Promise<Result<any>> {
    throw new NotImplementedError('Create admin is not implemented yet');
  }
}
