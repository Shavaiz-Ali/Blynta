import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { SourcePlatform } from '../schemas/job.schema';

const CreateJobSchema = z.object({
  sourceUrl: z.string().url(),
  sourcePlatform: z.nativeEnum(SourcePlatform),
  customPrompt: z.string().optional(),
  aiModel: z.string().optional(),
  resolution: z.string().optional(),
  // progressPercent: z.number()
});

export class CreateJobDto extends createZodDto(CreateJobSchema) { }
