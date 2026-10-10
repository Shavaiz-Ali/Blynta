import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { ActivitiesModule } from '../activities/activities.module';
import { RedisModule } from '../redis/redis.module';
import { AdminGuard } from '../admin/guards/admin.guard';
import { registryModels } from './registry.schemas';
import { CredentialVault } from './credential-vault.service';
import { GoogleAdapter } from './google-adapter.service';
import { ModelRegistry } from './model-registry.service';
import { HighlightRouting } from './highlight-routing.service';
import { AdminAIService } from './admin-ai.service';
import { AIRateLimitGuard } from './ai-rate-limit.guard';
import {
  AdminAIController,
  AvailableAIModelsController,
} from './registry.controllers';
@Module({
  imports: [
    MongooseModule.forFeature([
      ...registryModels,
      { name: User.name, schema: UserSchema },
    ]),
    ActivitiesModule,
    RedisModule,
  ],
  providers: [
    CredentialVault,
    GoogleAdapter,
    ModelRegistry,
    HighlightRouting,
    AdminAIService,
    AIRateLimitGuard,
    AdminGuard,
  ],
  controllers: [AdminAIController, AvailableAIModelsController],
  exports: [ModelRegistry, HighlightRouting, GoogleAdapter, AIRateLimitGuard],
})
export class AIRegistryModule {}
