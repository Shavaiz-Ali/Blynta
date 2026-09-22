import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import {
  ActivityCategory,
  ActivityStatus,
  ActivityType,
} from '../schemas/activity.schema';

const ListActivitiesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.nativeEnum(ActivityCategory).optional(),
  type: z.nativeEnum(ActivityType).optional(),
  status: z.nativeEnum(ActivityStatus).optional(),
  search: z.string().trim().max(200).optional(),
});

export class ListActivitiesDto extends createZodDto(ListActivitiesSchema) {}
