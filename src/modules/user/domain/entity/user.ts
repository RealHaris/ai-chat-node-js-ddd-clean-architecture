import { Aggregate, Result } from 'types-ddd';

import { UserAdded } from '~/modules/user/domain/event/user_added';

export interface UserCreationAttributes {
  id?: string;
  email: string;
  password: string;
  phone?: string;
  credentialUuid?: string;
}

export class User extends Aggregate<UserCreationAttributes> {
  private constructor(props: UserCreationAttributes) {
    super(props);
  }

  static create(props: UserCreationAttributes): Result<User> {
    const user = new User(props);
    const userAdded = new UserAdded();

    // event is applied to the user object
    user.addEvent(userAdded);

    return Result.Ok(user);
  }
}
