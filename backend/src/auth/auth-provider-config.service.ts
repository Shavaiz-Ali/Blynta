import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthProviderConfig, AuthProviderConfigDocument } from './schemas/auth-provider-config.schema';
import { AuthProvider } from '../users/schemas/user.schema';

@Injectable()
export class AuthProviderConfigService {
  constructor(
    @InjectModel(AuthProviderConfig.name)
    private configModel: Model<AuthProviderConfigDocument>,
  ) {}

  async getEnabledProviders(): Promise<AuthProvider[]> {
    const configs = await this.configModel.find({ isEnabled: true }).exec();
    return configs.map((c) => c.provider);
  }

  async isProviderEnabled(provider: AuthProvider): Promise<boolean> {
    const config = await this.configModel.findOne({ provider }).exec();
    return config ? config.isEnabled : false;
  }

  async setProviderEnabled(provider: AuthProvider, isEnabled: boolean, disabledReason?: string) {
    return this.configModel.findOneAndUpdate(
      { provider },
      { isEnabled, disabledReason: isEnabled ? undefined : disabledReason },
      { upsert: true, new: true },
    );
  }
}