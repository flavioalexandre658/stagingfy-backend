import { pgTable, uuid, text, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'succeeded', 'failed']);

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => user.id),
  stripePaymentIntentId: text('stripe_payment_intent_id').notNull().unique(),
  amount: integer('amount').notNull(), // in cents
  currency: text('currency').notNull().default('usd'),
  status: paymentStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});