import { pgTable, uuid, text, integer, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { roomTypes } from './room-types';
import { furnitureStyles } from './furniture-styles';
import { loras } from './loras';

export const jobStatusEnum = pgEnum('job_status', ['pending', 'processing', 'completed', 'failed']);

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => user.id),
  roomTypeId: uuid('room_type_id').notNull().references(() => roomTypes.id),
  furnitureStyleId: uuid('furniture_style_id').notNull().references(() => furnitureStyles.id),
  loraId: uuid('lora_id').references(() => loras.id),
  prompt: text('prompt').notNull(),
  inputImageUrl: text('input_image_url').notNull(), // S3 original
  outputImageUrl: text('output_image_url'), // S3 final
  status: jobStatusEnum('status').notNull().default('pending'),
  errorMessage: text('error_message'),
  model: text('model').notNull().default('flux-pro'),
  creditsUsed: integer('credits_used').notNull(),
  isPremiumRoomType: boolean('is_premium_room_type').notNull().default(false),
  isPremiumFurnitureStyle: boolean('is_premium_furniture_style').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});