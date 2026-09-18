import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const PublishToYouTubeSchema = z.object({
  /** YouTube video title — required, trimmed, max 100 chars (YouTube's limit is 100). */
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
});

export class PublishToYouTubeDto extends createZodDto(PublishToYouTubeSchema) {}
