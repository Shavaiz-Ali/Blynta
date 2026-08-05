import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const ResendOtpSchema = z.object({
  email: z.string().email(),
});

export class ResendOtpDto extends createZodDto(ResendOtpSchema) {}
