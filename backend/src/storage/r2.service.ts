import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';
import { Readable } from 'stream';

@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private configService: ConfigService) {
    this.bucket = this.configService.get<string>('R2_BUCKET_NAME', '');
    const endpoint = this.configService.get<string>('R2_ENDPOINT', '');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID', '');
    const secretAccessKey = this.configService.get<string>(
      'R2_SECRET_ACCESS_KEY',
      '',
    );

    this.client = new S3Client({
      region: 'auto', // R2 uses 'auto', not a real AWS region
      endpoint: endpoint || undefined,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  /**
   * Uploads an in-memory buffer directly to R2.
   */
  async uploadBuffer(
    buffer: Buffer,
    objectKey: string,
    contentType = 'image/jpeg',
  ): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    this.logger.log(
      `Uploaded buffer (${buffer.length} bytes) to R2 as ${objectKey}`,
    );
    return objectKey;
  }

  /**
   * Returns a direct public URL if R2_PUBLIC_DOMAIN is configured,
   * otherwise generates a long-lived (7 days) signed download URL.
   */
  async getPublicOrSignedUrl(
    objectKey: string,
    expiresInSeconds = 7 * 24 * 3600,
  ): Promise<string> {
    const publicDomain = this.configService.get<string>('R2_PUBLIC_DOMAIN');
    if (publicDomain) {
      const cleanDomain = publicDomain.replace(/\/$/, '');
      return `${cleanDomain}/${objectKey}`;
    }
    return this.getSignedDownloadUrl(objectKey, expiresInSeconds);
  }

  /**
   * Uploads a local file (already on disk from ffmpeg/whisper.cpp output) to R2.
   * Returns the object key.
   *
   * Example: await r2Service.uploadFile('/tmp/jobs/abc/clips/clip-1-captioned.mp4', 'clips/abc/clip-1-captioned.mp4')
   */
  async uploadFile(localPath: string, objectKey: string): Promise<string> {
    const fileStream = fs.createReadStream(localPath);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: fileStream,
        ContentType: 'video/mp4',
      }),
    );
    this.logger.log(`Uploaded ${localPath} to R2 as ${objectKey}`);
    return objectKey;
  }

  async fileExists(objectKey: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Downloads an R2 object back to a local temp path.
   * Needed because ffmpeg/whisper.cpp operate on real files, not remote URLs.
   *
   * Example: reusing a cached SourceVideo's audio file for a new Job means pulling
   * it from R2 into that Job's local temp working directory first.
   */
  async downloadToLocal(
    objectKey: string,
    localDestPath: string,
  ): Promise<void> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
    );
    const writeStream = fs.createWriteStream(localDestPath);
    await new Promise<void>((resolve, reject) => {
      (result.Body as NodeJS.ReadableStream)
        .pipe(writeStream)
        .on('finish', resolve)
        .on('error', reject);
    });
  }

  /**
   * Generates a time-limited signed URL for a private R2 object.
   * Used so clip downloads don't stream through your own Node process —
   * bandwidth is offloaded directly to R2/Cloudflare.
   *
   * Example: getSignedDownloadUrl('clips/abc/clip-1-captioned.mp4', 3600)
   *   => a URL valid for 1 hour.
   */
  async getSignedDownloadUrl(
    objectKey: string,
    expiresInSeconds = 3600,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async deleteFile(objectKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }),
    );
    this.logger.log(`Deleted R2 object: ${objectKey}`);
  }

  /**
   * Downloads an R2 object into an in-memory Buffer.
   * Used by the YouTube processor to read a custom thumbnail before calling thumbnails.set.
   */
  async downloadToBuffer(objectKey: string): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
    );
    const stream = result.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  /**
   * Generates a short-lived presigned PUT URL for direct client uploads to R2.
   * The frontend uses this to upload thumbnail images without routing through the API server.
   *
   * @param objectKey  - R2 object key to write to (e.g. "thumbnails/userId/abc123.jpg")
   * @param contentType - MIME type of the upload (e.g. "image/jpeg")
   * @param expiresIn  - URL expiry in seconds (default 5 minutes)
   */
  async getPresignedUploadUrl(
    objectKey: string,
    contentType: string,
    expiresIn = 300,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }
}
