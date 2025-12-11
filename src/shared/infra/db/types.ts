import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { admins } from './schemas/admins';
import { customers } from './schemas/customers';
import { users } from './schemas/users';

// Database row types
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Customer = InferSelectModel<typeof customers>;
export type NewCustomer = InferInsertModel<typeof customers>;

export type Admin = InferSelectModel<typeof admins>;
export type NewAdmin = InferInsertModel<typeof admins>;

// API response types (without database fields)
export type UserResponse = Omit<User, 'deletedAt'>;
export type CustomerResponse = Omit<Customer, 'deletedAt'>;
export type AdminResponse = Omit<Admin, 'deletedAt'>;

// Utility types for validation and utilities
export type ValidationResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type DatabaseRecord = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
};

export type RequestContext = {
  requestId?: string;
  user?: User;
  admin?: Admin;
  customer?: Customer;
};
