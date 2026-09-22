import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
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
import { YouTubeNotConnectedException } from './exceptions/youtube-not-connected.exception';

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
    const url = await this.youtubeOAuthService.getAuthorizationUrl(
      req.user.userId,
    );

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
      const errorMsg =
        err?.message || 'Failed to complete YouTube authorization.';
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
   * Returns all publications for the authenticated user with optional pagination, status, and search filters.
   */
  @Get('publications')
  @UseGuards(AuthGuard('jwt'))
  async getUserPublications(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const result = await this.youtubePublishingService.getAllUserPublications(
      req.user.userId,
      {
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
        status,
        search,
      },
    );
    return { success: true, data: result };
  }

  /**
   * Disconnects the user's YouTube account (revokes token & deletes connection).
   */
  @Delete('connection')
  @UseGuards(AuthGuard('jwt'))
  async disconnect(@Request() req) {
    return this.youtubePublishingService.disconnectYouTube(req.user.userId);
  }

  /**
   * Returns assignable YouTube video categories for the US region.
   *
   * Categories change very rarely — the frontend (TanStack Query) is responsible
   * for caching the response with an appropriate staleTime (30+ minutes).
   *
   * Requires the user to have a connected YouTube account so we can use their
   * access token for the YouTube Data API call.
   */
  @Get('categories')
  @UseGuards(AuthGuard('jwt'))
  async getVideoCategories(@Request() req) {
    try {
      const categories = await this.youtubePublishingService.getVideoCategories(
        req.user.userId,
      );
      return { success: true, data: { categories } };
    } catch (err: any) {
      if (err instanceof YouTubeNotConnectedException) {
        throw err; // Let the global exception filter handle it
      }
      throw new BadRequestException(
        err?.message || 'Failed to fetch YouTube categories.',
      );
    }
  }

  /**
   * Generates a short-lived presigned PUT URL for direct thumbnail uploads from the browser to R2.
   *
   * Body: { contentType: "image/jpeg" | "image/png" | "image/webp" }
   * Response: { presignedUrl: string, thumbnailKey: string }
   *
   * The frontend should:
   *   1. Call this endpoint to get the URL.
   *   2. PUT the image file directly to R2 using the presigned URL.
   *   3. Include the returned thumbnailKey in the publish payload.
   */
  @Post('thumbnails/presigned')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async getThumbnailPresignedUrl(
    @Request() req,
    @Body() body: { contentType?: string },
  ) {
    const contentType = body?.contentType;
    if (!contentType) {
      throw new BadRequestException('contentType is required.');
    }

    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowed.has(contentType)) {
      throw new BadRequestException(
        `Unsupported contentType. Must be one of: image/jpeg, image/png, image/webp.`,
      );
    }

    const result =
      await this.youtubePublishingService.createThumbnailPresignedUrl(
        req.user.userId,
        contentType,
      );

    return { success: true, data: result };
  }
}
