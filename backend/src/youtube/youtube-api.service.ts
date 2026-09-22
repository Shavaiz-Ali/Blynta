import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import { URL } from 'url';
import { Readable } from 'stream';

const YOUTUBE_UPLOAD_BASE =
  'https://www.googleapis.com/upload/youtube/v3/videos';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB
const MAX_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 1000;

export interface YouTubeVideoMetadata {
  title: string;
  description?: string;
  privacyStatus: 'private' | 'unlisted' | 'public';
  categoryId?: string;
  /** Optional list of tags to attach to the video (snippet.tags). */
  tags?: string[];
}

export interface YouTubeUploadResult {
  videoId: string;
  videoUrl: string;
}

@Injectable()
export class YouTubeApiService {
  private readonly logger = new Logger(YouTubeApiService.name);

  async uploadVideo(
    accessToken: string,
    metadata: YouTubeVideoMetadata,
    videoStream: Readable,
    contentLength?: number,
  ): Promise<YouTubeUploadResult> {
    const tempFile = path.join(
      os.tmpdir(),
      `blynta-youtube-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`,
    );

    try {
      // ---------------------------------------------------------------
      // 1. Persist the incoming stream so it can be replayed/resumed.
      // ---------------------------------------------------------------
      const actualContentLength = await this.saveStreamToFile(
        videoStream,
        tempFile,
      );

      if (
        contentLength !== undefined &&
        contentLength !== actualContentLength
      ) {
        this.logger.warn(
          `YouTube upload size mismatch: expected=${contentLength}, actual=${actualContentLength}`,
        );
      }

      // ---------------------------------------------------------------
      // 2. Initiate YouTube resumable upload session.
      // ---------------------------------------------------------------
      const sessionUri = await this.initiateResumableUpload(
        accessToken,
        metadata,
        actualContentLength,
      );

      // ---------------------------------------------------------------
      // 3. Upload using resumable chunks.
      // ---------------------------------------------------------------
      const videoId = await this.uploadFileResumably(
        accessToken,
        sessionUri,
        tempFile,
        actualContentLength,
      );

      return {
        videoId,
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      };
    } finally {
      // Always remove the temporary file.
      try {
        await fsp.unlink(tempFile);
      } catch {
        // File may already have been removed.
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Save incoming stream to a temporary file
  // ---------------------------------------------------------------------------

  private async saveStreamToFile(
    stream: Readable,
    filePath: string,
  ): Promise<number> {
    this.logger.log(`Saving video temporarily: ${filePath}`);

    let totalBytes = 0;

    const output = fs.createWriteStream(filePath);

    try {
      for await (const chunk of stream) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

        totalBytes += buffer.length;

        if (!output.write(buffer)) {
          await new Promise<void>((resolve, reject) => {
            output.once('drain', resolve);
            output.once('error', reject);
          });
        }
      }

      await new Promise<void>((resolve, reject) => {
        output.end(() => resolve());
        output.once('error', reject);
      });

      this.logger.log(`Video saved temporarily: ${totalBytes} bytes`);

      return totalBytes;
    } catch (error) {
      output.destroy();

      try {
        await fsp.unlink(filePath);
      } catch {
        // Ignore cleanup failure.
      }

      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Initiate resumable YouTube upload
  // ---------------------------------------------------------------------------

  private async initiateResumableUpload(
    accessToken: string,
    metadata: YouTubeVideoMetadata,
    contentLength: number,
  ): Promise<string> {
    const body = {
      snippet: {
        title: metadata.title,
        description: metadata.description ?? '',
        categoryId: metadata.categoryId ?? '22',
        ...(metadata.tags && metadata.tags.length > 0
          ? { tags: metadata.tags }
          : {}),
      },
      status: {
        privacyStatus: metadata.privacyStatus,
        selfDeclaredMadeForKids: false,
      },
    };

    const response = await fetch(
      `${YOUTUBE_UPLOAD_BASE}?uploadType=resumable&part=snippet,status`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': 'video/mp4',
          'X-Upload-Content-Length': String(contentLength),
        },
        body: JSON.stringify(body),
      },
    );

    const sessionUri = response.headers.get('location');

    if (!response.ok || !sessionUri) {
      const errorText = await response.text();

      throw new Error(
        `Failed to initiate YouTube resumable upload: ` +
          `${response.status} ${errorText}`,
      );
    }

    this.logger.log('YouTube resumable upload session initiated');

    return sessionUri;
  }

  // ---------------------------------------------------------------------------
  // Resumable chunked upload
  // ---------------------------------------------------------------------------

  private async uploadFileResumably(
    accessToken: string,
    sessionUri: string,
    filePath: string,
    totalSize: number,
  ): Promise<string> {
    let uploadedBytes = 0;

    while (uploadedBytes < totalSize) {
      const chunkStart = uploadedBytes;
      const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, totalSize) - 1;

      const chunkLength = chunkEnd - chunkStart + 1;

      let attempt = 0;

      while (true) {
        try {
          const result = await this.uploadChunk(
            accessToken,
            sessionUri,
            filePath,
            chunkStart,
            chunkEnd,
            totalSize,
          );

          // Upload completed.
          if (result.videoId) {
            this.logger.log(
              `YouTube upload complete — video ID: ${result.videoId}`,
            );

            return result.videoId;
          }

          // 308 — YouTube accepted the chunk.
          if (result.nextByte !== undefined) {
            uploadedBytes = result.nextByte;

            this.logger.log(
              `YouTube upload progress: ${uploadedBytes}/${totalSize} bytes`,
            );

            break;
          }

          throw new Error('YouTube returned an unexpected upload response');
        } catch (error: any) {
          attempt++;

          const retriable = this.isRetriableError(error);

          if (!retriable || attempt > MAX_RETRIES) {
            throw error;
          }

          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);

          this.logger.warn(
            `YouTube upload interrupted at byte ${chunkStart}. ` +
              `Attempt ${attempt}/${MAX_RETRIES}. ` +
              `Retrying in ${delay}ms. Error: ${error?.message}`,
          );

          await this.sleep(delay);

          // -------------------------------------------------------------
          // IMPORTANT:
          // Never assume YouTube received zero bytes.
          // Ask YouTube where the upload currently is.
          // -------------------------------------------------------------
          const serverPosition = await this.getUploadPosition(
            accessToken,
            sessionUri,
            totalSize,
          );

          if (serverPosition === totalSize) {
            // Upload actually completed but response was lost.
            const result = await this.getCompletedUploadId(
              accessToken,
              sessionUri,
              totalSize,
            );

            if (result) {
              return result;
            }
          }

          if (serverPosition !== undefined) {
            uploadedBytes = serverPosition;

            this.logger.log(
              `Resuming YouTube upload from byte ${uploadedBytes}`,
            );

            break;
          }
        }
      }

      // Prevent unused-variable lint issues in some configurations.
      void chunkLength;
    }

    throw new Error('YouTube upload ended without returning a video ID');
  }

  // ---------------------------------------------------------------------------
  // Upload one chunk
  // ---------------------------------------------------------------------------

  private async uploadChunk(
    accessToken: string,
    sessionUri: string,
    filePath: string,
    start: number,
    end: number,
    totalSize: number,
  ): Promise<{
    videoId?: string;
    nextByte?: number;
  }> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(sessionUri);

      const request = https.request(
        {
          protocol: parsedUrl.protocol,
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 443,
          path: `${parsedUrl.pathname}${parsedUrl.search}`,
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'video/mp4',
            'Content-Length': String(end - start + 1),
            'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          },
        },
        (response) => {
          let body = '';

          response.on('data', (chunk) => {
            body += chunk.toString();
          });

          response.on('end', () => {
            // ---------------------------------------------------------
            // Upload completed.
            // ---------------------------------------------------------
            if (response.statusCode === 200 || response.statusCode === 201) {
              try {
                const data = JSON.parse(body);

                if (!data.id) {
                  reject(
                    new Error(
                      'YouTube upload succeeded but no video ID was returned',
                    ),
                  );
                  return;
                }

                resolve({
                  videoId: data.id,
                });
                return;
              } catch {
                reject(
                  new Error(`Invalid YouTube completion response: ${body}`),
                );
                return;
              }
            }

            // ---------------------------------------------------------
            // Chunk accepted, more data required.
            // ---------------------------------------------------------
            if (response.statusCode === 308) {
              const range = response.headers.range;

              if (!range) {
                // Nothing confirmed yet.
                resolve({
                  nextByte: start,
                });
                return;
              }

              const match = /bytes=0-(\d+)/.exec(range);

              if (!match) {
                reject(new Error(`Invalid YouTube Range header: ${range}`));
                return;
              }

              const lastByte = Number(match[1]);

              resolve({
                nextByte: lastByte + 1,
              });

              return;
            }

            // ---------------------------------------------------------
            // Retriable server errors.
            // ---------------------------------------------------------
            if (
              response.statusCode === 500 ||
              response.statusCode === 502 ||
              response.statusCode === 503 ||
              response.statusCode === 504
            ) {
              reject(
                new Error(
                  `RETRIABLE_YOUTUBE_ERROR:${response.statusCode}:${body}`,
                ),
              );
              return;
            }

            // ---------------------------------------------------------
            // Permanent error.
            // ---------------------------------------------------------
            reject(
              new Error(
                `YouTube upload failed with status ${response.statusCode}: ${body}`,
              ),
            );
          });
        },
      );

      request.on('error', reject);

      const fileStream = fs.createReadStream(filePath, {
        start,
        end,
      });

      fileStream.on('error', reject);

      fileStream.pipe(request);
    });
  }

  // ---------------------------------------------------------------------------
  // Ask YouTube how many bytes it has received.
  // ---------------------------------------------------------------------------

  private async getUploadPosition(
    accessToken: string,
    sessionUri: string,
    totalSize: number,
  ): Promise<number | undefined> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(sessionUri);

      const request = https.request(
        {
          protocol: parsedUrl.protocol,
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 443,
          path: `${parsedUrl.pathname}${parsedUrl.search}`,
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Length': '0',
            'Content-Range': `bytes */${totalSize}`,
          },
        },
        (response) => {
          let body = '';

          response.on('data', (chunk) => {
            body += chunk.toString();
          });

          response.on('end', () => {
            // Upload already completed.
            if (response.statusCode === 200 || response.statusCode === 201) {
              resolve(totalSize);
              return;
            }

            // Upload still incomplete.
            if (response.statusCode === 308) {
              const range = response.headers.range;

              if (!range) {
                resolve(0);
                return;
              }

              const match = /bytes=0-(\d+)/.exec(range);

              if (!match) {
                reject(new Error(`Invalid YouTube Range header: ${range}`));
                return;
              }

              resolve(Number(match[1]) + 1);
              return;
            }

            // Session expired.
            if (response.statusCode === 404) {
              reject(new Error('YouTube resumable upload session expired'));
              return;
            }

            reject(
              new Error(
                `Failed to query YouTube upload position: ` +
                  `${response.statusCode} ${body}`,
              ),
            );
          });
        },
      );

      request.on('error', reject);
      request.end();
    });
  }

  // ---------------------------------------------------------------------------
  // If connection died after YouTube completed the upload but before we got
  // the response, ask for the final response again.
  // ---------------------------------------------------------------------------

  private async getCompletedUploadId(
    accessToken: string,
    sessionUri: string,
    totalSize: number,
  ): Promise<string | undefined> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(sessionUri);

      const request = https.request(
        {
          protocol: parsedUrl.protocol,
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 443,
          path: `${parsedUrl.pathname}${parsedUrl.search}`,
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Length': '0',
            'Content-Range': `bytes */${totalSize}`,
          },
        },
        (response) => {
          let body = '';

          response.on('data', (chunk) => {
            body += chunk.toString();
          });

          response.on('end', () => {
            if (response.statusCode === 200 || response.statusCode === 201) {
              try {
                const data = JSON.parse(body);
                resolve(data?.id);
              } catch {
                resolve(undefined);
              }

              return;
            }

            if (response.statusCode === 308) {
              resolve(undefined);
              return;
            }

            reject(
              new Error(
                `Failed to confirm YouTube upload: ` +
                  `${response.statusCode} ${body}`,
              ),
            );
          });
        },
      );

      request.on('error', reject);
      request.end();
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private isRetriableError(error: any): boolean {
    const message = String(error?.message ?? '');

    return (
      message.includes('ECONNRESET') ||
      message.includes('ECONNABORTED') ||
      message.includes('ETIMEDOUT') ||
      message.includes('EPIPE') ||
      message.includes('RETRIABLE_YOUTUBE_ERROR')
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Verifies a video exists on YouTube.
   */
  async getVideoStatus(
    accessToken: string,
    videoId: string,
  ): Promise<{ status: string } | null> {
    try {
      const response = await fetch(
        `${YOUTUBE_API_BASE}/videos?part=status&id=${videoId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const item = data?.items?.[0];

      return item ? { status: item.status.uploadStatus } : null;
    } catch {
      return null;
    }
  }

  /**
   * Sets a custom thumbnail for a YouTube video using the thumbnails.set endpoint.
   *
   * IMPORTANT: This must be called AFTER the video upload completes and a video ID is available.
   * Failure of this method should NOT cause the overall publication to fail — the video already
   * exists on YouTube. Callers must handle errors independently.
   *
   * @param accessToken - Valid YouTube OAuth access token
   * @param videoId     - The YouTube video ID returned by videos.insert
   * @param imageBuffer - Raw image data (JPEG, PNG, or WEBP)
   * @param contentType - MIME type of the image buffer (default: 'image/jpeg')
   */
  async setThumbnail(
    accessToken: string,
    videoId: string,
    imageBuffer: Buffer,
    contentType = 'image/jpeg',
  ): Promise<void> {
    this.logger.log(`Setting custom thumbnail for video ${videoId}`);

    const url = `${YOUTUBE_UPLOAD_BASE.replace('/videos', '/thumbnails')}/set?videoId=${encodeURIComponent(videoId)}&uploadType=media`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': contentType,
        'Content-Length': String(imageBuffer.length),
      },
      body: new Uint8Array(imageBuffer),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to set YouTube thumbnail: ${response.status} ${errorText}`,
      );
    }

    this.logger.log(`Custom thumbnail set successfully for video ${videoId}`);
  }

  /**
   * Fetches YouTube video categories for a given region.
   * Results should be cached by the caller (e.g. Redis) to avoid repeated API calls.
   *
   * @param accessToken  - Valid YouTube OAuth access token
   * @param regionCode   - ISO 3166-1 alpha-2 region code (default: 'US')
   */
  async listVideoCategories(
    accessToken: string,
    regionCode = 'US',
  ): Promise<Array<{ id: string; title: string }>> {
    const url = `${YOUTUBE_API_BASE}/videoCategories?part=snippet&regionCode=${encodeURIComponent(regionCode)}&hl=en`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch YouTube categories: ${response.status} ${errorText}`,
      );
    }

    const data = await response.json();
    const items: Array<{
      id: string;
      snippet: { title: string; assignable: boolean };
    }> = data?.items ?? [];

    // Only return assignable categories (not all categories can be assigned to videos)
    return items
      .filter((item) => item.snippet.assignable)
      .map((item) => ({ id: item.id, title: item.snippet.title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }
}
