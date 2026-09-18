import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const CreateShareSchema = z.object({
  jobId: z.string().min(1, 'jobId is required'),
  clipId: z.string().min(1, 'clipId is required'),
  /** ISO-8601 date string. When provided must be a future date. */
  expiresAt: z
    .string()
    .datetime({ message: 'expiresAt must be a valid ISO-8601 datetime' })
    .refine((val) => new Date(val) > new Date(), {
      message: 'expiresAt must be a future date',
    })
    .optional(),
});

export class CreateShareDto extends createZodDto(CreateShareSchema) {}
