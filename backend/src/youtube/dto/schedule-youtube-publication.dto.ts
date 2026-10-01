import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const futureIsoDate = z
  .string()
  .datetime({ offset: true })
  .refine((value) => new Date(value).getTime() > Date.now() + 60_000, {
    message: 'Schedule time must be at least one minute in the future',
  });

const ScheduleYouTubePublicationSchema = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(5000).optional(),
  privacyStatus: z.enum(['private', 'unlisted', 'public']).default('private'),
  tags: z.array(z.string().trim().min(1).max(500)).max(30).optional(),
  categoryId: z.string().trim().optional(),
  thumbnailKey: z.string().trim().optional(),
  scheduledAt: futureIsoDate,
  timezone: z.string().trim().min(1).max(100).optional(),
});

export class ScheduleYouTubePublicationDto extends createZodDto(
  ScheduleYouTubePublicationSchema,
) {}

export class RescheduleYouTubePublicationDto extends createZodDto(
  z.object({
    scheduledAt: futureIsoDate,
    timezone: z.string().trim().min(1).max(100).optional(),
  }),
) {}
