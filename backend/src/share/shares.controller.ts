import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SharesService } from './shares.service';
import { CreateShareDto } from './dto/create-share.dto';
import { UpdateShareDto } from './dto/update-share.dto';

@Controller('shares')
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  /**
   * GET /shares/public/:token — resolve a public share token.
   *
   * IMPORTANT: This route MUST be declared before GET /:id so that NestJS
   * does not try to treat the literal string "public" as a share ID.
   * No authentication required.
   */
  @Get('public/:token')
  resolvePublicShare(@Param('token') token: string) {
    return this.sharesService.resolvePublicShare(token);
  }

  // -----------------------------------------------------------------------
  // Authenticated management endpoints
  // -----------------------------------------------------------------------

  @UseGuards(AuthGuard('jwt'))
  @Post()
  createShare(@Request() req, @Body() dto: CreateShareDto) {
    return this.sharesService.createShare(req.user.userId, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  getMyShares(@Request() req, @Query('clipId') clipId?: string) {
    return this.sharesService.getMyShares(req.user.userId, clipId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  getShareById(@Request() req, @Param('id') id: string) {
    return this.sharesService.getShareById(req.user.userId, id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  updateShare(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateShareDto,
  ) {
    return this.sharesService.updateShare(req.user.userId, id, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  revokeShare(@Request() req, @Param('id') id: string) {
    return this.sharesService.revokeShare(req.user.userId, id);
  }
}
