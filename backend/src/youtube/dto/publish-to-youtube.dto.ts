import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const PublishToYouTubeSchema = z.object({
  /** YouTube video title — required, trimmed, max 100 chars (YouTube's limit). */
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(100, 'Title must be 100 characters or fewer'),

  /** YouTube video description — optional, max 5000 chars (YouTube's limit). */
  description: z
    .string()
    .trim()
    .max(5000, 'Description must be 5000 characters or fewer')
    .optional(),

  /** YouTube privacy setting. */
  privacyStatus: z.enum(['private', 'unlisted', 'public']),

  /**
   * YouTube video tags — optional.
   * YouTube allows up to 500 characters total across all tags,
   * but we enforce a reasonable per-tag and count limit here.
   */
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(500, 'Each tag must be 500 characters or fewer'),
    )
    .max(30, 'A maximum of 30 tags is allowed')
    .optional(),

  /**
   * YouTube video category ID (from videoCategories.list).
   * Optional — YouTube defaults to the channel's default category if omitted.
   */
  categoryId: z.string().trim().optional(),

  /**
   * R2 object key for a custom thumbnail image previously uploaded to R2.
   * If provided, the worker will call thumbnails.set after the video upload completes.
   * A failed thumbnail upload does NOT fail the publication.
   */
  thumbnailKey: z.string().trim().optional(),
});

export class PublishToYouTubeDto extends createZodDto(PublishToYouTubeSchema) {}
