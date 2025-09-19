import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { roomTypes } from './room-types';
import { furnitureStyles } from './furniture-styles';

export const loras = pgTable('loras', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomTypeId: uuid('room_type_id').notNull().references(() => roomTypes.id),
  furnitureStyleId: uuid('furniture_style_id').notNull().references(() => furnitureStyles.id),
  name: text('name').notNull(), // like "lora_bedroom_scandinavian_v1"
  fileUrl: text('file_url').notNull(), // S3 path
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});