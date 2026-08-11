import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { JobStatus } from '../schemas/job.schema';

const ListJobsSchema = z.object({
  status: z.nativeEnum(JobStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export class ListJobsDto extends createZodDto(ListJobsSchema) {}
