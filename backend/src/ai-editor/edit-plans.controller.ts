import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { EditPlansService } from './edit-plans.service';
import { EditRateLimitGuard } from './edit-rate-limit.guard';
type UserRequest = Request & { user: { userId: string } };
@Controller('ai-editor')
@UseGuards(AuthGuard('jwt'), EditRateLimitGuard)
export class EditPlansController {
  constructor(private service: EditPlansService) {}
  @Get('plans') recent(@Req() r: UserRequest) {
    return this.service.recent(r.user.userId);
  }
  @Get('assets') assets(@Req() r: UserRequest) {
    return this.service.ownedAssets(r.user.userId);
  }
  @Post('initialize') initialize(@Req() r: UserRequest, @Body() body: unknown) {
    return this.service.initialize(r.user.userId, body);
  }
  @Post('plans') create(@Req() r: UserRequest, @Body() body: unknown) {
    return this.service.create(r.user.userId, body);
  }
  @Get('plans/:id') get(@Req() r: UserRequest, @Param('id') id: string) {
    return this.service.get(r.user.userId, id);
  }
  @Put('plans/:id') update(
    @Req() r: UserRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.update(r.user.userId, id, body);
  }
  @Post('plans/:id/validate') validate(
    @Req() r: UserRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.validate(r.user.userId, id, body);
  }
  @Post('plans/:id/preview') render(
    @Req() r: UserRequest,
    @Param('id') id: string,
  ) {
    return this.service.render(r.user.userId, id);
  }
  @Get('plans/:id/versions') versions(
    @Req() r: UserRequest,
    @Param('id') id: string,
    @Query('page') page?: string,
  ) {
    return this.service.listVersions(
      r.user.userId,
      id,
      page === undefined ? 1 : Number(page),
    );
  }
  @Get('versions/:id') version(@Req() r: UserRequest, @Param('id') id: string) {
    return this.service.getVersion(r.user.userId, id);
  }
  @Post('versions/:id/download') download(
    @Req() r: UserRequest,
    @Param('id') id: string,
  ) {
    return this.service.downloadVersion(r.user.userId, id);
  }
  @Post('versions/:id/retry') retry(
    @Req() r: UserRequest,
    @Param('id') id: string,
  ) {
    return this.service.retry(r.user.userId, id);
  }
  @Post('versions/:id/cancel') cancel(
    @Req() r: UserRequest,
    @Param('id') id: string,
  ) {
    return this.service.cancel(r.user.userId, id);
  }
}
