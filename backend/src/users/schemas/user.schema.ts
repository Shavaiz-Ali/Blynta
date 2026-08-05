import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export enum UserPlan {
  FREE = 'free',
  PRO = 'pro',
  BUSINESS = 'business',
}

// Add new providers here ONLY — no other schema changes needed to support a new one
export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
  APPLE = 'apple',
  GITHUB = 'github',
}

export const PLAN_CREDITS: Record<UserPlan, number> = {
  [UserPlan.FREE]: 5,
  [UserPlan.PRO]: 50,
  [UserPlan.BUSINESS]: 200,
};

// One linked external account — a user can have many of these, one per provider
@Schema({ _id: false })
export class LinkedAccount {
  @Prop({ required: true, enum: AuthProvider })
  provider: AuthProvider;

  @Prop({ required: true })
  providerId: string; // the stable ID that provider gives us (Google's "sub", Facebook's "id", etc.)

  @Prop({ default: () => new Date() })
  linkedAt: Date;
}
export const LinkedAccountSchema = SchemaFactory.createForClass(LinkedAccount);

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ select: false })
  password?: string; // absent entirely for social-only accounts

  @Prop({ trim: true })
  name: string;

  @Prop()
  avatarUrl: string;

  @Prop({ default: false })
  emailVerified: boolean;

  @Prop({ enum: UserRole, default: UserRole.USER })
  role: UserRole;

  // --- Auth: generic, extensible ---
  @Prop({ type: [LinkedAccountSchema], default: [] })
  linkedAccounts: LinkedAccount[];

  // --- Plan & billing ---
  @Prop({ enum: UserPlan, default: UserPlan.FREE })
  plan: UserPlan;

  @Prop()
  stripeCustomerId: string;

  @Prop()
  stripeSubscriptionId: string;

  @Prop({ default: true })
  isActive: boolean;

  // --- Credits system ---
  @Prop({ default: PLAN_CREDITS[UserPlan.FREE] })
  creditsBalance: number;

  @Prop({ default: 0 })
  totalCreditsUsed: number;

  @Prop({ default: () => new Date() })
  creditsResetAt: Date;

  // --- Security/auditing ---
  @Prop()
  lastLoginAt: Date;

  @Prop({ select: false })
  refreshTokenHash: string;
  @Prop()
  otpCode: string; // hashed, never plain

  @Prop()
  otpExpiresAt: Date;

  @Prop()
  passwordResetToken: string; // hashed

  @Prop()
  passwordResetExpiresAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Ensures the same provider+providerId pair can't be linked to two different users,
// while still allowing many different providers per user.
UserSchema.index(
  { 'linkedAccounts.provider': 1, 'linkedAccounts.providerId': 1 },
  { unique: true, sparse: true },
);