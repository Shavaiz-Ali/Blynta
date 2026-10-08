import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { SourcePlatform } from '../schemas/job.schema';
import { STYLE_PRESETS } from '../../media/style-presets';

const CreateJobSchema = z.object({
  sourceUrl: z.string().url(),
  sourcePlatform: z.nativeEnum(SourcePlatform),
  customPrompt: z.string().optional(),
  aiModel: z.string().optional(),
  stylePreset: z
    .string()
    .refine((val) => Object.keys(STYLE_PRESETS).includes(val), {
      message: `Invalid style preset. Must be one of: ${Object.keys(STYLE_PRESETS).join(', ')}`,
    })
    .optional(),
  resolution: z.string().optional(),
  operationId: z.string().uuid().optional(),
  sourceSeconds: z.number().positive().max(14400).optional(),
  maxOutputSeconds: z.number().positive().max(3600).optional(),
  authorizedCredits: z.number().int().positive().max(10000).optional(),
  pricingVersion: z.string().max(80).optional(),
  // progressPercent: z.number()
});

export class CreateJobDto extends createZodDto(CreateJobSchema) {}
