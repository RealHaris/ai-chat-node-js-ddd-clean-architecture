import { Entity, Result, Ok } from 'types-ddd';

export interface CustomerCreationAttributes {
  id?: string;
  userId: string;
  name?: string;
  notes?: string;
}

export class Customer extends Entity<CustomerCreationAttributes> {
  private constructor(props: CustomerCreationAttributes) {
    super(props);
  }

  static create(props: CustomerCreationAttributes): Result<Customer> {
    return Ok(new Customer(props));
  }
}
