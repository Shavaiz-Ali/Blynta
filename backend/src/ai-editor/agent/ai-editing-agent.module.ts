import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RedisModule } from '../../redis/redis.module';
import { AIRegistryModule } from '../../ai-registry/ai-registry.module';
import { AiEditorModule } from '../ai-editor.module';
import { agentModels } from './agent.schemas';
import { AgentTools } from './agent-tools.service';
import { EditingGraph } from './editing-graph.service';
import { ProposalsService } from './proposals.service';
import { AgentController } from './agent.controller';
import { StorageModule } from '../../storage/storage.module';
import { EmojiAssetsService } from './emoji-assets.service';
@Module({
  imports: [
    AiEditorModule,
    AIRegistryModule,
    RedisModule,
    StorageModule,
    MongooseModule.forFeature(agentModels),
  ],
  providers: [EmojiAssetsService, AgentTools, EditingGraph, ProposalsService],
  controllers: [AgentController],
})
export class AIEditingAgentModule {}
