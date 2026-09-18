import {
  Controller,
  Delete,
  Get,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { YouTubeOAuthService } from './youtube-oauth.service';
import { YouTubePublishingService } from './youtube-publishing.service';

@Controller('youtube')
export class YouTubeController {
  private readonly frontendUrl: string;

  constructor(
    private youtubeOAuthService: YouTubeOAuthService,
    private youtubePublishingService: YouTubePublishingService,
    private configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
  }

  /**
   * Generates a Google OAuth authorization URL for the authenticated user.
   * Returns { url: string } or redirects directly if ?redirect=true is passed.
   */
  @Get('connect')
  @UseGuards(AuthGuard('jwt'))
  async connect(
    @Request() req,
    @Query('redirect') redirect: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    const url = await this.youtubeOAuthService.getAuthorizationUrl(req.user.userId);

    if (redirect === 'true') {
      return res.redirect(url);
    }

    return res.json({ success: true, data: { url } });
  }

  /**
   * OAuth 2.0 callback endpoint from Google.
   * Public (Google redirects the user's browser here).
   * Validates state (CSRF), exchanges code for tokens, saves connection,
   * then redirects user back to frontend dashboard.
   */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    if (error || !code || !state) {
      const errorMsg = error || 'Authorization was cancelled or failed.';
      return res.redirect(
        `${this.frontendUrl}/dashboard?youtube_error=${encodeURIComponent(errorMsg)}`,
      );
    }

    try {
      await this.youtubeOAuthService.handleCallback(code, state);
      return res.redirect(`${this.frontendUrl}/dashboard?youtube=connected`);
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to complete YouTube authorization.';
      return res.redirect(
        `${this.frontendUrl}/dashboard?youtube_error=${encodeURIComponent(errorMsg)}`,
      );
    }
  }

  /**
   * Returns the current user's YouTube connection status and channel snippet.
   */
  @Get('status')
  @UseGuards(AuthGuard('jwt'))
  async getStatus(@Request() req) {
    return this.youtubePublishingService.getConnectionStatus(req.user.userId);
  }

  /**
   * Disconnects the user's YouTube account (revokes token & deletes connection).
   */
  @Delete('connection')
  @UseGuards(AuthGuard('jwt'))
  async disconnect(@Request() req) {
    return this.youtubePublishingService.disconnectYouTube(req.user.userId);
  }
}
