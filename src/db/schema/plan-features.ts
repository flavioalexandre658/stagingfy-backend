import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const planFeatures = pgTable('plan_features', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(), // slug like "unlimited_downloads"
  label: text('label').notNull(), // display name like "Unlimited renders and downloads"
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});