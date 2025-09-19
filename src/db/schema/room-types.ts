import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const roomTypes = pgTable('room_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(), // slug like "living_room"
  label: text('label').notNull(), // display name like "Sala de Estar"
  premiumOnly: boolean('premium_only').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});