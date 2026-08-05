import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const SocialLoginSchema = z.object({
  providerId: z.string(),
  email: z.string().email(),
  name: z.string(),
  avatarUrl: z.string().url().optional(),
});

export class SocialLoginDto extends createZodDto(SocialLoginSchema) {}
