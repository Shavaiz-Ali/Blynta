import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import {
  NotificationCategory,
  NotificationStatus,
} from '../schemas/notification.schema';

const ListNotificationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.nativeEnum(NotificationStatus).optional(),
  category: z.nativeEnum(NotificationCategory).optional(),
});

export class ListNotificationsDto extends createZodDto(
  ListNotificationsSchema,
) {}
