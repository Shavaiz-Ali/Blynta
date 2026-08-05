import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const VerifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

export class VerifyOtpDto extends createZodDto(VerifyOtpSchema) {}
