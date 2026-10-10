import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../admin/guards/admin.guard';
import { AIRateLimitGuard } from './ai-rate-limit.guard';
import { AdminAIService } from './admin-ai.service';
import { ModelRegistry } from './model-registry.service';
import { aiTask } from './registry.contract';
import { parseEdit } from '../ai-editor/edit-plan.contract';
type AIRequest = { user: { userId: string } };
@Controller('admin/ai')
@UseGuards(AuthGuard('jwt'), AdminGuard, AIRateLimitGuard)
export class AdminAIController {
  constructor(private service: AdminAIService) {}
  @Get('providers') providers(@Query() q: unknown) {
    return this.service.list('providers', q);
  }
  @Post('providers') provider(@Req() r: AIRequest, @Body() b: unknown) {
    return this.service.provider(r.user.userId, b);
  }
  @Patch('providers/:id') updateProvider(
    @Req() r: AIRequest,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.provider(r.user.userId, b, id);
  }
  @Get('providers/:id/credentials') credentials(@Param('id') id: string) {
    return this.service.credentials(id);
  }
  @Post('providers/:id/credentials') addCredential(
    @Req() r: AIRequest,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.addCredential(r.user.userId, id, b);
  }
  @Patch('credentials/:id') replace(
    @Req() r: AIRequest,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.replaceCredential(r.user.userId, id, b);
  }
  @Delete('credentials/:id') remove(
    @Req() r: AIRequest,
    @Param('id') id: string,
  ) {
    return this.service.deleteCredential(r.user.userId, id);
  }
  @Post('credentials/:id/validate') validate(
    @Req() r: AIRequest,
    @Param('id') id: string,
  ) {
    return this.service.validateCredential(r.user.userId, id);
  }
  @Get('models') models(@Query() q: unknown) {
    return this.service.list('models', q);
  }
  @Get('models/:id') model(@Param('id') id: string) {
    return this.service.getModel(id);
  }
  @Post('models') addModel(@Req() r: AIRequest, @Body() b: unknown) {
    return this.service.model(r.user.userId, b);
  }
  @Patch('models/:id') updateModel(
    @Req() r: AIRequest,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.service.model(r.user.userId, b, id);
  }
  @Delete('models/:id') archive(@Req() r: AIRequest, @Param('id') id: string) {
    return this.service.archive(r.user.userId, id);
  }
  @Post('models/:id/test') test(@Req() r: AIRequest, @Param('id') id: string) {
    return this.service.test(r.user.userId, id);
  }
  @Post('models/:id/set-default') setDefault(
    @Req() r: AIRequest,
    @Param('id') id: string,
  ) {
    return this.service.setDefault(r.user.userId, id);
  }
  @Get('usage') usage(@Query() q: unknown) {
    return this.service.list('usage', q);
  }
}
@Controller('ai/models')
@UseGuards(AuthGuard('jwt'), AIRateLimitGuard)
export class AvailableAIModelsController {
  constructor(private registry: ModelRegistry) {}
  @Get('available') available(
    @Req() r: AIRequest,
    @Query('task') task?: string,
  ) {
    return this.registry.available(
      r.user.userId,
      parseEdit(aiTask, task ?? 'edit_planning'),
    );
  }
}
