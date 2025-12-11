import { Customer } from '~/modules/customer/domain/entity/customer';
import { Customer as CustomerModel } from '~/shared/infra/db/types';

export interface ICustomerCreateRepository {
  save(customer: Customer): Promise<CustomerModel>;
}

export type ICustomerWriteRepository = ICustomerCreateRepository;
