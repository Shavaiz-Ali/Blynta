import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type PipelineArtifactDocument = HydratedDocument<PipelineArtifact>;

/** Internal worker artifacts; never exposed through job or public download APIs. */
@Schema({ timestamps: true })
export class PipelineArtifact {
  @Prop({ required: true, immutable: true }) key: string;
  @Prop({ required: true, enum: ['transcript', 'highlights'], immutable: true })
  kind: string;
  @Prop({ required: true, immutable: true }) sourceVersion: string;
  @Prop({ required: true, immutable: true }) payloadHash: string;
  @Prop({ type: MongooseSchema.Types.Mixed, required: true, immutable: true })
  payload: unknown;
  @Prop({ type: MongooseSchema.Types.Mixed, immutable: true })
  metadata?: Record<string, string>;
  @Prop({ required: true }) expiresAt: Date;
}

export const PipelineArtifactSchema =
  SchemaFactory.createForClass(PipelineArtifact);
PipelineArtifactSchema.index({ key: 1 }, { unique: true });
PipelineArtifactSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
