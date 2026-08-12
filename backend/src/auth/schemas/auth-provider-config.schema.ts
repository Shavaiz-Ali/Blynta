import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { AuthProvider } from '../../users/schemas/user.schema';

export type AuthProviderConfigDocument = AuthProviderConfig & Document;

@Schema({ timestamps: true })
export class AuthProviderConfig {
  @Prop({ required: true, unique: true, enum: AuthProvider })
  provider: AuthProvider;

  @Prop({ default: true })
  isEnabled: boolean;

  @Prop()
  disabledReason: string;
}

export const AuthProviderConfigSchema = SchemaFactory.createForClass(AuthProviderConfig);