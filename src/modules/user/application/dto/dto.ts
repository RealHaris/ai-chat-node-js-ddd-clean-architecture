import { z } from 'zod';

import { CustomerAttributesSchema } from '~/modules/customer/domain/interface/customer';
import { UserAttributesSchema } from '~/modules/user/domain/interface/user';

export const CreateUserDTOSchema = UserAttributesSchema.pick({
  email: true,
  phone: true,
  password: true,
}).merge(
  CustomerAttributesSchema.pick({
    name: true,
    notes: true,
  })
);

export type CreateUserDTO = z.infer<typeof CreateUserDTOSchema>;
