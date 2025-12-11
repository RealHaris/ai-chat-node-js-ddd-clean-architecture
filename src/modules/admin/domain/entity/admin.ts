import { Entity, Result, Ok } from 'types-ddd';

export interface AdminCreationAttributes {
  id?: string;
  userId: string;
}

export class Admin extends Entity<AdminCreationAttributes> {
  private constructor(props: AdminCreationAttributes) {
    super(props);
  }

  static create(props: AdminCreationAttributes): Result<Admin> {
    return Ok(new Admin(props));
  }
}
