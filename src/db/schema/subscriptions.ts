import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { plans } from './plans';

export const subscriptionStatusEnum = pgEnum('subscription_status', ['active', 'canceled', 'past_due']);

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => user.id),
  planId: uuid('plan_id').notNull().references(() => plans.id),
  stripeSubscriptionId: text('stripe_subscription_id').notNull().unique(),
  status: subscriptionStatusEnum('status').notNull().default('active'),
  currentPeriodStart: timestamp('current_period_start').notNull(),
  currentPeriodEnd: timestamp('current_period_end').notNull(),
  renewalAt: timestamp('renewal_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});