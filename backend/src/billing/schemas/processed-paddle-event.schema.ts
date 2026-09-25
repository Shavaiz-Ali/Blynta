import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProcessedPaddleEventDocument = ProcessedPaddleEvent & Document;

/**
 * Stores Paddle event IDs that have already been processed.
 * Acts as the idempotency store for the Paddle webhook handler.
 * Documents automatically expire after 30 days via TTL index.
 */
@Schema({ timestamps: true })
export class ProcessedPaddleEvent {
  @Prop({ required: true, unique: true, index: true })
  eventId: string;

  @Prop({ required: true })
  eventType: string;

  @Prop()
  processedAt: Date;
}

export const ProcessedPaddleEventSchema =
  SchemaFactory.createForClass(ProcessedPaddleEvent);

// TTL index: auto-delete docs 30 days after processedAt
ProcessedPaddleEventSchema.index(
  { processedAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30 },
);
