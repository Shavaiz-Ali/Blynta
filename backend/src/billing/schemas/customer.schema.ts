import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CustomerDocument = Customer & Document;

/**
 * Holds all Paddle billing state for a user.
 * Kept separate from User so that identity/auth (User) and billing state
 * (Customer) can evolve independently and be loaded independently.
 * One Customer document per User — linked by userId.
 */
@Schema({ timestamps: true })
export class Customer {
  /** The Blynta user this billing record belongs to. */
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  })
  userId: Types.ObjectId;

  /** Paddle's permanent customer ID (ctm_xxx). Never changes for a given email. */
  @Prop({ required: true, unique: true, index: true })
  paddleCustomerId: string;

  /** Active or most-recent Paddle subscription ID (sub_xxx). */
  @Prop({ index: true, sparse: true })
  paddleSubscriptionId?: string;

  /** Paddle product ID that the active subscription is on. */
  @Prop()
  paddleProductId?: string;

  /** Paddle price ID that the active subscription is on. */
  @Prop()
  paddlePriceId?: string;

  /** Subscription lifecycle status as reported by Paddle. */
  @Prop()
  paddleSubscriptionStatus?: string; // 'active' | 'trialing' | 'past_due' | 'paused' | 'canceled'

  /** Scheduled action pending at end of billing period. */
  @Prop({ type: String, default: null })
  paddleScheduledChangeAction?: string | null; // 'cancel' | 'pause' | null

  /** When the scheduled change takes effect. */
  @Prop({ type: Date, default: null })
  paddleScheduledChangeAt?: Date | null;

  /**
   * Actual billing period end date from Paddle — used as creditsResetAt
   * instead of locally computed nextMonth(), so credits reset exactly when
   * Paddle charges the card.
   */
  @Prop()
  currentBillingPeriodEndsAt?: Date;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
