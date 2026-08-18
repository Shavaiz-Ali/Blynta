import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReferralRewardDocument = ReferralReward & Document;

@Schema({ timestamps: true })
export class ReferralReward {
    @Prop({ type: Types.ObjectId, required: true, ref: 'User', index: true })
    referrerId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, required: true, ref: 'User' })
    referredUserId: Types.ObjectId;

    @Prop({ required: true })
    referrerCreditsAwarded: number;

    @Prop({ required: true })
    referredUserCreditsAwarded: number;
}

export const ReferralRewardSchema = SchemaFactory.createForClass(ReferralReward);

// One reward per referral relationship, ever — a second attempt to reward the same
// referrer+referredUser pair will fail at the database level, even if application
// logic somehow tried to call this twice.
ReferralRewardSchema.index({ referrerId: 1, referredUserId: 1 }, { unique: true });