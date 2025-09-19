import { pgTable, uuid, timestamp } from 'drizzle-orm/pg-core';
import { plans } from './plans';
import { planFeatures } from './plan-features';

export const planFeatureRelations = pgTable('plan_feature_relations', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id').notNull().references(() => plans.id, { onDelete: 'cascade' }),
  featureId: uuid('feature_id').notNull().references(() => planFeatures.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});