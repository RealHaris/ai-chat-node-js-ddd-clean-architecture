import {
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    email: text('email'),
    password: text('password').notNull(),
    phone: text('phone'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => {
    return {
      emailIdx: index('users_email_idx').using(
        'btree',
        table.email.asc().nullsLast()
      ),
      phoneIdx: index('users_phone_idx').using(
        'btree',
        table.phone.asc().nullsLast()
      ),
    };
  }
);

export const admins = pgTable(
  'admins',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => {
    return {
      userIdIdx: index('admins_user_id_idx').using(
        'btree',
        table.userId.asc().nullsLast()
      ),
      adminsUserIdUsersIdFk: foreignKey({
        columns: [table.userId],
        foreignColumns: [users.id],
        name: 'admins_user_id_users_id_fk',
      }).onDelete('cascade'),
    };
  }
);

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    name: text('name'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  table => {
    return {
      userIdIdx: index('customers_user_id_idx').using(
        'btree',
        table.userId.asc().nullsLast()
      ),
      customersUserIdUsersIdFk: foreignKey({
        columns: [table.userId],
        foreignColumns: [users.id],
        name: 'customers_user_id_users_id_fk',
      }).onDelete('cascade'),
    };
  }
);
