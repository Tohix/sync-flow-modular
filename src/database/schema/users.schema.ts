import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { v7 } from 'uuid';

export const users = pgTable('users', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => v7()),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
