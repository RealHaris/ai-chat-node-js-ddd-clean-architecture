import { Aggregate } from 'types-ddd';

import {
  User,
  UserCreationAttributes,
} from '~/modules/user/domain/entity/user';
import { User as UserModel } from '~/shared/infra/db/types';

export interface IUserGetAllRepository {
  getAll(): Promise<UserModel[]>;
}

export interface IUserGetByIdRepository {
  getByUserUuid(userUuid: string): Promise<UserModel>;
}

export interface IUserReadRepository
  extends IUserGetAllRepository, IUserGetByIdRepository {}

export interface IUserCreateRepository {
  getById(id: Aggregate<UserCreationAttributes>['id']): Promise<UserModel>;
  save(user: User): Promise<UserModel>;
}

export type IUserWriteRepository = IUserCreateRepository;
