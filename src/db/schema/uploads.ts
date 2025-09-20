import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { user } from './auth';

// Enum para status do upload
export const uploadStatusEnum = pgEnum('upload_status', [
  'pending',
  'processing', 
  'completed',
  'failed'
]);

// Enum para tipos de ambiente
export const roomTypeEnum = pgEnum('room_type', [
  'bedroom',
  'living_room',
  'kitchen',
  'bathroom',
  'home_office',
  'dining_room',
  'kids_room',
  'outdoor'
]);

// Enum para estilos de móveis
export const furnitureStyleEnum = pgEnum('furniture_style', [
  'standard',
  'modern',
  'scandinavian',
  'industrial',
  'midcentury',
  'luxury',
  'coastal',
  'farmhouse'
]);

// Enum para providers de IA
export const providerEnum = pgEnum('provider', [
  'black-forest',
  'instant-deco'
]);

export const uploads = pgTable('uploads', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  roomType: roomTypeEnum('room_type').notNull(),
  furnitureStyle: furnitureStyleEnum('furniture_style').notNull(),
  provider: providerEnum('provider').default('black-forest').notNull(),
  inputImageUrl: text('input_image_url').notNull(),
  outputImageUrl: text('output_image_url'),
  outputImageUrls: text('output_image_urls'), // JSON string array para múltiplas URLs
  maskUrl: text('mask_url'), // URL da máscara salva no S3
  status: uploadStatusEnum('status').default('pending').notNull(),
  errorMessage: text('error_message'),
  blackForestJobId: text('black_forest_job_id'), // ID do job na API da Black Forest
  instantDecoRequestId: text('instant_deco_request_id'), // ID da requisição na API da InstantDeco
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});