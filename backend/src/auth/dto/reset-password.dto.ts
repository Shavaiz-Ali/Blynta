import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const ResetPasswordSchema = z.object({
  token: z.string().max(256),
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Za-z]/)
    .regex(/\d/),
});

export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}
