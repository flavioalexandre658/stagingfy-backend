import { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import * as schema from '@/db/schema';

// User types (BetterAuth compatible)
export type User = InferSelectModel<typeof schema.user>;
export type NewUser = InferInsertModel<typeof schema.user>;

// Profile types
export type Profile = InferSelectModel<typeof schema.profiles>;
export type NewProfile = InferInsertModel<typeof schema.profiles>;

// Room type types
export type RoomType = InferSelectModel<typeof schema.roomTypes>;
export type NewRoomType = InferInsertModel<typeof schema.roomTypes>;

// Furniture style types
export type FurnitureStyle = InferSelectModel<typeof schema.furnitureStyles>;
export type NewFurnitureStyle = InferInsertModel<typeof schema.furnitureStyles>;

// Lora types
export type Lora = InferSelectModel<typeof schema.loras>;
export type NewLora = InferInsertModel<typeof schema.loras>;

// Job types
export type Job = InferSelectModel<typeof schema.jobs>;
export type NewJob = InferInsertModel<typeof schema.jobs>;

// Plan types
export type Plan = InferSelectModel<typeof schema.plans>;
export type NewPlan = InferInsertModel<typeof schema.plans>;

// Plan feature types
export type PlanFeature = InferSelectModel<typeof schema.planFeatures>;
export type NewPlanFeature = InferInsertModel<typeof schema.planFeatures>;

// Plan feature relation types
export type PlanFeatureRelation = InferSelectModel<typeof schema.planFeatureRelations>;
export type NewPlanFeatureRelation = InferInsertModel<typeof schema.planFeatureRelations>;

// Subscription types
export type Subscription = InferSelectModel<typeof schema.subscriptions>;
export type NewSubscription = InferInsertModel<typeof schema.subscriptions>;

// Payment types
export type Payment = InferSelectModel<typeof schema.payments>;
export type NewPayment = InferInsertModel<typeof schema.payments>;

// Audit log types
export type AuditLog = InferSelectModel<typeof schema.auditLogs>;
export type NewAuditLog = InferInsertModel<typeof schema.auditLogs>;

// Session types (BetterAuth compatible)
export type Session = InferSelectModel<typeof schema.session>;
export type NewSession = InferInsertModel<typeof schema.session>;

// Account types (BetterAuth compatible)
export type Account = InferSelectModel<typeof schema.account>;
export type NewAccount = InferInsertModel<typeof schema.account>;

// Verification token types (BetterAuth compatible)
export type VerificationToken = InferSelectModel<typeof schema.verification>;
export type NewVerificationToken = InferInsertModel<typeof schema.verification>;