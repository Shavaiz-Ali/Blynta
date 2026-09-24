import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AuthProviderConfig,
  AuthProviderConfigDocument,
} from './schemas/auth-provider-config.schema';
import { AuthProvider } from '../users/schemas/user.schema';

@Injectable()
export class AuthProviderConfigService implements OnModuleInit {
  private readonly logger = new Logger(AuthProviderConfigService.name);

  constructor(
    @InjectModel(AuthProviderConfig.name)
    private configModel: Model<AuthProviderConfigDocument>,
  ) {}

  async onModuleInit() {
    try {
      const count = await this.configModel.countDocuments().exec();
      if (count === 0) {
        this.logger.log('No auth provider configs found in DB. Auto-seeding defaults...');
        const defaultProviders = [
          { provider: AuthProvider.LOCAL, isEnabled: true },
          { provider: AuthProvider.GOOGLE, isEnabled: true },
          { provider: AuthProvider.FACEBOOK, isEnabled: true },
          { provider: AuthProvider.APPLE, isEnabled: false, disabledReason: 'Not yet implemented' },
          { provider: AuthProvider.GITHUB, isEnabled: false, disabledReason: 'Not yet implemented' },
        ];
        await this.configModel.insertMany(defaultProviders);
        this.logger.log('Default auth providers seeded successfully.');
      }
    } catch (err) {
      this.logger.error('Failed to auto-seed auth providers on startup:', err);
    }
  }

  async getEnabledProviders(): Promise<AuthProvider[]> {
    const configs = await this.configModel.find({ isEnabled: true }).exec();
    if (!configs || configs.length === 0) {
      return [AuthProvider.LOCAL, AuthProvider.GOOGLE, AuthProvider.FACEBOOK];
    }
    return configs.map((c) => c.provider);
  }

  async isProviderEnabled(provider: AuthProvider): Promise<boolean> {
    const config = await this.configModel.findOne({ provider }).exec();
    if (!config) {
      // Default to true for standard local/google/facebook providers
      return [AuthProvider.LOCAL, AuthProvider.GOOGLE, AuthProvider.FACEBOOK].includes(provider);
    }
    return config.isEnabled;
  }

  async setProviderEnabled(
    provider: AuthProvider,
    isEnabled: boolean,
    disabledReason?: string,
  ) {
    return this.configModel.findOneAndUpdate(
      { provider },
      { isEnabled, disabledReason: isEnabled ? undefined : disabledReason },
      { upsert: true, new: true },
    );
  }
}
