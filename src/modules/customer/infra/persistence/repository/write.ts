import { singleton } from 'tsyringe';

import { BaseWriteRepository } from '~/shared/infra/persistence/repository/write';
import { ICustomerWriteRepository } from '~/modules/customer/domain/interface/repository';
import { customers } from '~/shared/infra/db/schemas/customers';
import { db } from '~/shared/infra/db/config/config';

@singleton()
export class CustomerWriteRepository
  extends BaseWriteRepository<typeof customers, any>
  implements ICustomerWriteRepository
{
  constructor() {
    super(customers, db);
  }

  async save(customer: any): Promise<any> {
    return super.save(customer);
  }
}
