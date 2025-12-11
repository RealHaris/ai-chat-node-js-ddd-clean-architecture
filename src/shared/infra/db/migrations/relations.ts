import { relations } from 'drizzle-orm/relations';
import { users, admins, customers } from './schema';

export const adminsRelations = relations(admins, ({ one }) => ({
  user: one(users, {
    fields: [admins.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  admins: many(admins),
  customers: many(customers),
}));

export const customersRelations = relations(customers, ({ one }) => ({
  user: one(users, {
    fields: [customers.userId],
    references: [users.id],
  }),
}));
