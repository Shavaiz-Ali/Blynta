import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { YouTubePublishingService } from './youtube-publishing.service';
import { PublishToYouTubeDto } from './dto/publish-to-youtube.dto';

@Controller('jobs/:jobId/clips/:clipId/publications')
@UseGuards(AuthGuard('jwt'))
export class YouTubeClipController {
  constructor(private youtubePublishingService: YouTubePublishingService) {}

  /**
   * Publishes a clip to YouTube. Creates a ClipPublication record and enqueues a background upload job.
   */
  @Post('youtube')
  async publishToYouTube(
    @Request() req,
    @Param('jobId') jobId: string,
    @Param('clipId') clipId: string,
    @Body() dto: PublishToYouTubeDto,
  ) {
    return this.youtubePublishingService.publishClip(
      req.user.userId,
      jobId,
      clipId,
      dto,
    );
  }

  /**
   * Retrieves all publication records for a specific clip.
   */
  @Get()
  async getPublications(
    @Request() req,
    @Param('jobId') jobId: string,
    @Param('clipId') clipId: string,
  ) {
    return this.youtubePublishingService.getPublications(
      req.user.userId,
      jobId,
      clipId,
    );
  }

  /**
   * Retries a failed publication.
   */
  @Post(':publicationId/retry')
  async retryPublication(
    @Request() req,
    @Param('jobId') jobId: string,
    @Param('clipId') clipId: string,
    @Param('publicationId') publicationId: string,
  ) {
    return this.youtubePublishingService.retryPublication(
      req.user.userId,
      jobId,
      clipId,
      publicationId,
    );
  }
}
