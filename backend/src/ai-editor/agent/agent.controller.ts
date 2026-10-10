import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AIRateLimitGuard } from '../../ai-registry/ai-rate-limit.guard';
import { ProposalsService } from './proposals.service';
@Controller('clips/:clipId/ai-edit')
@UseGuards(AuthGuard('jwt'), AIRateLimitGuard)
export class AgentController {
  constructor(private service: ProposalsService) {}
  @Get('state') state(
    @Req() r: { user: { userId: string } },
    @Param('clipId') clipId: string,
    @Query('planId') planId: string,
  ) {
    return this.service.state(r.user.userId, clipId, planId);
  }
  @Post('propose') propose(
    @Req() r: { user: { userId: string } },
    @Param('clipId') clipId: string,
    @Body() body: unknown,
  ) {
    return this.service.propose(r.user.userId, clipId, body);
  }
  @Get('proposals/:id') get(
    @Req() r: { user: { userId: string } },
    @Param('clipId') clipId: string,
    @Param('id') id: string,
  ) {
    return this.service.get(r.user.userId, clipId, id);
  }
  @Post('proposals/:id/apply') apply(
    @Req() r: { user: { userId: string } },
    @Param('clipId') clipId: string,
    @Param('id') id: string,
  ) {
    return this.service.apply(r.user.userId, clipId, id);
  }
  @Post('proposals/:id/reject') reject(
    @Req() r: { user: { userId: string } },
    @Param('clipId') clipId: string,
    @Param('id') id: string,
  ) {
    return this.service.reject(r.user.userId, clipId, id);
  }
  @Get('sessions/:id') history(
    @Req() r: { user: { userId: string } },
    @Param('clipId') clipId: string,
    @Param('id') id: string,
  ) {
    return this.service.history(r.user.userId, clipId, id);
  }
}
