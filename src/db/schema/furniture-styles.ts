import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const furnitureStyles = pgTable('furniture_styles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(), // slug like "scandinavian"
  label: text('label').notNull(), // display name like "Escandinavo"
  premiumOnly: boolean('premium_only').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});