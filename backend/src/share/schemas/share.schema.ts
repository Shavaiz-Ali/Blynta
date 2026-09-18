import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ShareDocument = HydratedDocument<Share>;

@Schema({
    timestamps: true,
    collection: 'shares',
})
export class Share {
    @Prop({
        type: Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    })
    ownerId: Types.ObjectId;

    @Prop({
        type: Types.ObjectId,
        ref: 'Job',
        required: true,
        index: true,
    })
    jobId: Types.ObjectId;

    @Prop({
        type: Types.ObjectId,
        required: true,
        index: true,
    })
    clipId: Types.ObjectId;

    @Prop({
        type: String,
        required: true,
        unique: true,
        index: true,
    })
    tokenHash: string;

    @Prop({
        type: Boolean,
        default: true,
        index: true,
    })
    isActive: boolean;

    @Prop({
        type: Date,
        default: null,
    })
    expiresAt: Date | null;

    @Prop({
        type: Date,
        default: null,
    })
    revokedAt: Date | null;

    @Prop({
        type: Number,
        default: 0,
    })
    accessCount: number;

    @Prop({
        type: Date,
        default: null,
    })
    lastAccessedAt: Date | null;
}

export const ShareSchema = SchemaFactory.createForClass(Share);

ShareSchema.index({
    ownerId: 1,
    clipId: 1,
});

ShareSchema.index({
    expiresAt: 1,
});