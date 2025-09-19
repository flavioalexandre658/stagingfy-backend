import { pgTable, uuid, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';

export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(), // "Basic", "Standard", "Professional", "Enterprise"
  priceMonthly: integer('price_monthly').notNull(), // in cents
  priceYearly: integer('price_yearly').notNull(), // in cents
  photosPerMonth: integer('photos_per_month').notNull(),
  isPopular: boolean('is_popular').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});