import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SubscriptionEventDocument = SubscriptionEvent & Document;

/**
 * Append-only audit log — one row per meaningful subscription lifecycle change.
 *
 * Answers support questions like:
 *  - "Why does this user have X credits?"      → query creditsGranted > 0
 *  - "Did they game the schedule/resume cycle?" → query previousPlan === newPlan && creditsGranted > 0
 *  - "What plan were they on before we downgraded them?"
 */
@Schema({ timestamps: true })
export class SubscriptionEvent {
  /** The Blynta user this event belongs to. */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, index: true })
  paddleSubscriptionId: string;

  /** The Paddle webhook event ID that caused this row — matches ProcessedPaddleEvent.eventId. */
  @Prop({ required: true, index: true })
  paddleEventId: string;

  /** e.g. 'subscription.updated', 'subscription.canceled', 'transaction.completed' */
  @Prop({ required: true })
  eventType: string;

  @Prop()
  previousPlan?: string;

  @Prop()
  newPlan?: string;

  @Prop()
  previousPriceId?: string;

  @Prop()
  newPriceId?: string;

  /**
   * Credits granted as part of this event.
   * 0 or absent = this event did NOT refill credits (e.g. schedule-cancel then resume).
   * Used to detect regressions: events where previousPlan === newPlan && creditsGranted > 0
   * should be zero after the credit-refill fix.
   */
  @Prop({ default: 0 })
  creditsGranted?: number;

  /** Full Paddle webhook payload kept for debugging / support. */
  @Prop({ type: Object })
  rawPayload?: Record<string, any>;
}

export const SubscriptionEventSchema =
  SchemaFactory.createForClass(SubscriptionEvent);
