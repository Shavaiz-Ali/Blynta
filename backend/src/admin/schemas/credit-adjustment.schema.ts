import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CreditAdjustmentDocument = CreditAdjustment & Document;

@Schema({ timestamps: true, collection: 'credit_adjustments' })
export class CreditAdjustment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  adminId: Types.ObjectId;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  previousBalance: number;

  @Prop({ required: true })
  newBalance: number;

  @Prop({ required: true, trim: true })
  reason: string;
}

export const CreditAdjustmentSchema =
  SchemaFactory.createForClass(CreditAdjustment);
