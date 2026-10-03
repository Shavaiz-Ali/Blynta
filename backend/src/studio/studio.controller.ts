import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { StudioService } from './studio.service';
type UserRequest = Request & { user: { userId: string } };
@Controller('studio')
@UseGuards(AuthGuard('jwt'))
export class StudioController {
  constructor(private readonly studio: StudioService) {}
  @Get('projects') list(@Req() req: UserRequest) {
    return this.studio.list(req.user.userId);
  }
  @Post('projects') create(@Req() req: UserRequest, @Body() body: unknown) {
    return this.studio.create(req.user.userId, body);
  }
  @Post('from-clip') fromClip(@Req() req: UserRequest, @Body() body: unknown) {
    return this.studio.fromClip(req.user.userId, body);
  }
  @Post('projects/:id/duplicate') duplicate(
    @Req() req: UserRequest,
    @Param('id') id: string,
  ) {
    return this.studio.duplicate(req.user.userId, id);
  }
  @Get('projects/:id') get(@Req() req: UserRequest, @Param('id') id: string) {
    return this.studio.get(req.user.userId, id);
  }
  @Put('projects/:id/timeline') save(
    @Req() req: UserRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.studio.save(req.user.userId, id, body);
  }
  @Patch('projects/:id') rename(
    @Req() req: UserRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.studio.rename(req.user.userId, id, body);
  }
  @Delete('projects/:id') remove(
    @Req() req: UserRequest,
    @Param('id') id: string,
  ) {
    return this.studio.remove(req.user.userId, id);
  }
  @Get('projects/:id/assets') assets(
    @Req() req: UserRequest,
    @Param('id') id: string,
  ) {
    return this.studio.assets(req.user.userId, id);
  }
  @Post('projects/:id/assets/upload') upload(
    @Req() req: UserRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.studio.upload(req.user.userId, id, body);
  }
  @Post('projects/:id/assets/complete') complete(
    @Req() req: UserRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.studio.complete(req.user.userId, id, body);
  }
  @Post('projects/:id/ai/propose') propose(
    @Req() req: UserRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.studio.propose(req.user.userId, id, body);
  }
  @Post('projects/:id/renders') render(
    @Req() req: UserRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.studio.render(req.user.userId, id, body);
  }
  @Get('renders/:id') status(@Req() req: UserRequest, @Param('id') id: string) {
    return this.studio.renderStatus(req.user.userId, id);
  }
}
