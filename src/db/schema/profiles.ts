import { pgTable, uuid, text, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const roleEnum = pgEnum('role', ['user', 'admin']);

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => user.id).unique(),
  name: text('name').notNull(),
  role: roleEnum('role').notNull().default('user'),
  credits: integer('credits').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});