import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => user.id),
  action: text('action').notNull(), // ex: "create_job", "update_subscription"
  metadata: jsonb('metadata'), // additional data about the action
  createdAt: timestamp('created_at').notNull().defaultNow(),
});